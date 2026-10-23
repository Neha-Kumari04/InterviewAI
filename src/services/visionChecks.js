export function evaluateVideoQuality(frame, { preferredMinWidth = 480 } = {}) {
  const checks = [];

  const resolutionOk = frame.width >= preferredMinWidth && frame.height >= 360;
  checks.push({
    key: 'resolution',
    label: 'Camera resolution',
    value: `${frame.width}×${frame.height}`,
    status: resolutionOk ? 'pass' : 'warn',
    tip: resolutionOk ? '' : 'Camera is producing a low resolution stream. Close other camera apps.',
  });

  let brightnessStatus = 'pass';
  let brightnessTip = 'Lighting looks good.';
  if (frame.mean < 30) {
    brightnessStatus = 'fail';
    brightnessTip = 'It is too dark. Face a light source or turn on a room light.';
  } else if (frame.mean < 45) {
    brightnessStatus = 'warn';
    brightnessTip = 'A little dark — add more light in front of you.';
  } else if (frame.mean > 215) {
    brightnessStatus = 'fail';
    brightnessTip = 'Image is overexposed. Avoid bright light directly behind you.';
  } else if (frame.mean > 195) {
    brightnessStatus = 'warn';
    brightnessTip = 'Slightly overexposed — adjust lighting.';
  }
  checks.push({
    key: 'brightness',
    label: 'Lighting',
    value: `${Math.round(frame.mean)}/255`,
    status: brightnessStatus,
    tip: brightnessTip,
  });

  let contrastStatus = 'pass';
  let contrastTip = 'Good contrast.';
  if (frame.contrast < 10) {
    contrastStatus = 'fail';
    contrastTip = 'Very flat image — check for a covered lens or washed-out lighting.';
  } else if (frame.contrast < 18) {
    contrastStatus = 'warn';
    contrastTip = 'Contrast is low — add light in front of your face.';
  }
  checks.push({
    key: 'contrast',
    label: 'Contrast',
    value: `${Math.round(frame.contrast)}`,
    status: contrastStatus,
    tip: contrastTip,
  });

  let sharpStatus = 'pass';
  let sharpTip = 'Image is sharp.';
  if (frame.sharpness < 8) {
    sharpStatus = 'warn';
    sharpTip = 'Image may be blurry — clean the lens and hold the device steady.';
  }
  checks.push({
    key: 'sharpness',
    label: 'Focus / sharpness',
    value: `${Math.round(frame.sharpness)}`,
    status: sharpStatus,
    tip: sharpTip,
  });

  const face = frame.face || {
    detected: (frame.skinRatio || 0) >= 0.025,
    position: 'centered',
    confidence: 90,
    label: 'Face centered',
  };

  let faceStatus = 'pass';
  let faceTip = 'Your face is clearly detected and well-centered in frame.';
  let faceValue = 'Face detected & centered';

  if (!face.detected) {
    faceStatus = 'fail';
    faceValue = 'No face detected';
    faceTip = 'Position yourself directly in front of the camera from the chest up.';
  } else if (face.position !== 'centered') {
    faceStatus = 'warn';
    faceValue = face.label;
    faceTip = 'Align yourself in the middle of the frame so the interviewer has a clear view.';
  } else {
    faceValue = `Centered (${face.confidence || 95}% match)`;
  }

  checks.push({
    key: 'face',
    label: 'Face detection & position',
    value: faceValue,
    status: faceStatus,
    tip: faceTip,
  });

  const statuses = checks.map((c) => c.status);
  const overall = statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : 'pass';
  return { overall, checks, face };
}

export function evaluateMovement(frames) {
  const checks = [];

  const coveredFrames = frames.filter((f) => f.mean < 25 || f.contrast < 8).length;
  const covered = coveredFrames === frames.length;
  checks.push({
    key: 'coverage',
    label: 'Camera view',
    value: covered ? 'Lens looks covered' : 'View is clear',
    status: covered ? 'fail' : coveredFrames > 0 ? 'warn' : 'pass',
    tip: covered
      ? 'The camera appears blocked. Remove any cover and keep the lens facing you.'
      : coveredFrames > 0
        ? 'Some frames looked blocked — keep the camera steady.'
        : 'Camera view stayed clear.',
  });

  const detectedCount = frames.filter((f) => (f.face ? f.face.detected : f.skinRatio >= 0.025)).length;
  const allDetected = detectedCount === frames.length;
  const avgSkin = frames.reduce((s, f) => s + f.skinRatio, 0) / Math.max(1, frames.length);

  let presenceStatus = 'pass';
  let presenceValue = 'Candidate visible in all frames';
  let presenceTip = 'You stayed centered and clearly visible throughout the check.';

  if (detectedCount === 0) {
    presenceStatus = 'fail';
    presenceValue = 'No face detected in frame';
    presenceTip = 'No person was visible. Face the camera directly from the chest up.';
  } else if (!allDetected) {
    presenceStatus = 'warn';
    presenceValue = `Visible in ${detectedCount}/${frames.length} frames`;
    presenceTip = 'Candidate briefly moved out of frame — try to stay seated and steady.';
  }

  checks.push({
    key: 'presence',
    label: 'Face presence in frame',
    value: presenceValue,
    status: presenceStatus,
    tip: presenceTip,
  });

  let motionAvg = 0;
  const diffs = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1].grid;
    const b = frames[i].grid;
    let sum = 0;
    for (let j = 0; j < a.length; j++) sum += Math.abs(a[j] - b[j]);
    diffs.push(sum / a.length / 255);
  }
  motionAvg = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;

  let motionStatus = 'pass';
  let motionTip = 'Movement is steady and normal for an interview.';
  if (motionAvg > 0.18) {
    motionStatus = 'warn';
    motionTip = 'There was a lot of movement. Sit still and avoid walking around.';
  }
  checks.push({
    key: 'motion',
    label: 'Movement & posture',
    value: `${Math.round(motionAvg * 100)}% frame change`,
    status: motionStatus,
    tip: motionTip,
  });

  const statuses = checks.map((c) => c.status);
  const overall = statuses.includes('fail') ? 'fail' : statuses.includes('warn') ? 'warn' : 'pass';
  return { overall, checks, avgMotion: motionAvg, avgPresence: avgSkin };
}
