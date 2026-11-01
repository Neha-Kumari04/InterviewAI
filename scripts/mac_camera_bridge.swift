import AVFoundation
import CoreImage
import CoreMedia
import Darwin
import Foundation
import ImageIO

class CameraManager: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    static let shared = CameraManager()
    
    private let lock = NSLock()
    private var _latestJpeg: Data?
    private var _latestBase64: String?
    private var _width: Int = 640
    private var _height: Int = 480
    private var _frameCount: Int = 0
    private let context = CIContext(options: [.useSoftwareRenderer: false])
    private let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    private let session = AVCaptureSession()
    
    var isRunning: Bool { session.isRunning }
    var frameCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return _frameCount
    }
    
    func getLatestJpeg() -> Data? {
        lock.lock()
        defer { lock.unlock() }
        return _latestJpeg
    }
    
    func getLatestPayload() -> (base64: String, width: Int, height: Int)? {
        lock.lock()
        defer { lock.unlock() }
        guard let b64 = _latestBase64 else { return nil }
        return (b64, _width, _height)
    }
    
    func start() {
        guard let device = AVCaptureDevice.default(for: .video) else {
            fputs("[Bridge] Error: No camera device found.\n", stderr)
            return
        }
        
        do {
            session.sessionPreset = .vga640x480
            let input = try AVCaptureDeviceInput(device: device)
            if session.canAddInput(input) { session.addInput(input) }
            
            let output = AVCaptureVideoDataOutput()
            output.alwaysDiscardsLateVideoFrames = true
            output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
            
            let queue = DispatchQueue(label: "camera.bridge.queue", qos: .userInteractive)
            output.setSampleBufferDelegate(self, queue: queue)
            if session.canAddOutput(output) { session.addOutput(output) }
            
            session.startRunning()
            fputs("[Bridge] Camera session started with device: \(device.localizedName)\n", stderr)
        } catch {
            fputs("[Bridge] Failed to start camera: \(error)\n", stderr)
        }
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        let width = CVPixelBufferGetWidth(imageBuffer)
        let height = CVPixelBufferGetHeight(imageBuffer)
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        
        // Mirror horizontally so front camera looks natural to the user
        let mirrored = ciImage.transformed(by: CGAffineTransform(scaleX: -1, y: 1).translatedBy(x: -CGFloat(width), y: 0))
        
        guard let jpeg = context.jpegRepresentation(of: mirrored, colorSpace: colorSpace, options: [:]) else {
            return
        }
        
        let b64 = jpeg.base64EncodedString()
        
        lock.lock()
        _latestJpeg = jpeg
        _latestBase64 = b64
        _width = width
        _height = height
        _frameCount += 1
        lock.unlock()
    }
}

// Request permission if needed
let authStatus = AVCaptureDevice.authorizationStatus(for: .video)
if authStatus == .notDetermined {
    let sema = DispatchSemaphore(value: 0)
    AVCaptureDevice.requestAccess(for: .video) { _ in sema.signal() }
    sema.wait()
}

CameraManager.shared.start()

// Setup HTTP Socket Server on 127.0.0.1:8089
let serverSocket = socket(AF_INET, SOCK_STREAM, 0)
var yes: Int32 = 1
setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))

var addr = sockaddr_in()
addr.sin_family = sa_family_t(AF_INET)
addr.sin_port = in_port_t(8089).bigEndian
addr.sin_addr.s_addr = inet_addr("127.0.0.1")

let bindResult = withUnsafePointer(to: &addr) {
    $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        bind(serverSocket, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
    }
}

if bindResult < 0 {
    fputs("[Bridge] Failed to bind to port 8089: errno \(errno)\n", stderr)
    exit(1)
}

listen(serverSocket, 32)
fputs("[Bridge] HTTP Server running on http://127.0.0.1:8089\n", stderr)

DispatchQueue.global(qos: .userInteractive).async {
    while true {
        let client = accept(serverSocket, nil, nil)
        if client < 0 { continue }
        
        var buffer = [UInt8](repeating: 0, count: 2048)
        let bytesRead = recv(client, &buffer, buffer.count - 1, 0)
        let reqString = bytesRead > 0 ? String(cString: buffer) : ""
        
        // Handle routes
        if reqString.contains("GET /frame.json") {
            if let payload = CameraManager.shared.getLatestPayload() {
                let json = "{\"status\":\"ok\",\"width\":\(payload.width),\"height\":\(payload.height),\"base64\":\"\(payload.base64)\"}"
                let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-cache, no-store\r\nContent-Length: \(json.utf8.count)\r\nConnection: close\r\n\r\n\(json)"
                _ = resp.withCString { send(client, $0, strlen($0), 0) }
            } else {
                let json = "{\"status\":\"waiting\",\"message\":\"Initializing camera feed...\"}"
                let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: \(json.utf8.count)\r\nConnection: close\r\n\r\n\(json)"
                _ = resp.withCString { send(client, $0, strlen($0), 0) }
            }
        } else if reqString.contains("GET /frame") || reqString.contains("GET /live.jpg") {
            if let jpeg = CameraManager.shared.getLatestJpeg() {
                let header = "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-cache, no-store\r\nContent-Length: \(jpeg.count)\r\nConnection: close\r\n\r\n"
                _ = header.withCString { send(client, $0, strlen($0), 0) }
                jpeg.withUnsafeBytes { ptr in
                    if let baseAddress = ptr.baseAddress {
                        _ = send(client, baseAddress, jpeg.count, 0)
                    }
                }
            } else {
                let msg = "Camera warming up"
                let resp = "HTTP/1.1 503 Service Unavailable\r\nContent-Type: text/plain\r\nContent-Length: \(msg.utf8.count)\r\nConnection: close\r\n\r\n\(msg)"
                _ = resp.withCString { send(client, $0, strlen($0), 0) }
            }
        } else {
            // GET /status or root
            let count = CameraManager.shared.frameCount
            let json = "{\"status\":\"ok\",\"running\":\(CameraManager.shared.isRunning),\"frameCount\":\(count),\"bridge\":\"InterviewAI Mac Camera Bridge\"}"
            let resp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: \(json.utf8.count)\r\nConnection: close\r\n\r\n\(json)"
            _ = resp.withCString { send(client, $0, strlen($0), 0) }
        }
        
        close(client)
    }
}

// Keep process running
dispatchMain()
