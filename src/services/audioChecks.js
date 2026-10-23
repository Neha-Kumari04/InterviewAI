const SPEECH_ACTIVE_DB = -48;

function stats(samples) {
  if (!samples.length) return { count: 0, avg: -160, peak: -160, min: -160 };
  let sum = 0;
  let peak = -999;
  let min = 999;
  for (const s of samples) {
    sum += s;
    if (s > peak) peak = s;
    if (s < min) min = s;
  }
  return { count: samples.length, avg: sum / samples.length, peak, min };
}

export function evaluateVoice(samples) {
  const validSamples = samples.filter((s) => typeof s === 'number' && !isNaN(s) && s > -150);
  if (!validSamples.length) {
    return {
      status: 'fail',
      avgDb: -160,
      peakDb: -160,
      activeRatio: 0,
      clarity: 0,
      issues: ['No microphone levels detected'],
      instructions: [
        'Check that microphone permission is enabled.',
        'Speak audibly into the device microphone.',
        'On simulators, verify audio input is routed or use the simulator sample mode.',
      ],
    };
  }

  const all = stats(validSamples);
  const active = validSamples.filter((s) => s > SPEECH_ACTIVE_DB);
  const activeStats = stats(active.length ? active : validSamples);
  const clarity = Math.max(0.1, Math.min(1, (activeStats.avg + 55) / 40));

  const issues = [];
  let status = 'pass';

  if (all.peak < -50) {
    status = 'fail';
    issues.push('Voice is very quiet on the microphone');
  } else if (all.peak < -38) {
    status = 'warn';
    issues.push('Voice level is slightly low');
  }

  const activeRatio = active.length / validSamples.length;
  if (activeRatio < 0.12 && status === 'pass') {
    status = 'warn';
    issues.push('Only a brief phrase was heard — try speaking a full sentence');
  }

  if (all.peak > -3 && validSamples.filter((s) => s > -3).length / validSamples.length > 0.15) {
    status = 'warn';
    issues.push('Audio may be clipping — move back slightly from the mic');
  }

  const instructions = [];
  if (status !== 'pass') {
    instructions.push('Move about an arm’s length from the microphone.');
    instructions.push('Speak in a steady, confident conversational tone.');
    instructions.push('Avoid whispering or speaking away from the device.');
  } else {
    instructions.push('Your voice is clear and easy to understand.');
  }

  return {
    status,
    avgDb: Math.round(activeStats.avg),
    peakDb: Math.round(all.peak),
    activeRatio,
    clarity: Number(clarity.toFixed(2)),
    issues,
    instructions,
  };
}

export function evaluateNoise(samples) {
  const validSamples = samples.filter((s) => typeof s === 'number' && !isNaN(s) && s > -150);
  if (!validSamples.length) {
    return {
      status: 'fail',
      noiseDb: -160,
      issues: ['Could not sample ambient noise'],
      instructions: [
        'Stay still and quiet while the room check runs.',
        'Ensure microphone input is connected.',
      ],
    };
  }

  const all = stats(validSamples);
  const issues = [];
  let status = 'pass';
  if (all.avg > -35) {
    status = 'fail';
    issues.push('The room is noisy — background sound is high');
  } else if (all.avg > -48) {
    status = 'warn';
    issues.push('Some background noise was detected');
  }

  const instructions = [];
  if (status !== 'pass') {
    instructions.push('Move to a quieter room and close windows/doors.');
    instructions.push('Mute fans, speakers and background media.');
    instructions.push('Ask people nearby to stay quiet during the interview.');
  } else {
    instructions.push('Ambient noise is low — good environment for the interview.');
  }

  return { status, noiseDb: Math.round(all.avg), peakDb: Math.round(all.peak), issues, instructions };
}

export function computeSnr(voice, noise) {
  const snr = (voice.avgDb !== undefined ? voice.avgDb : voice.peakDb) - noise.noiseDb;
  let status = 'pass';
  const issues = [];
  if (snr < 8) {
    status = 'fail';
    issues.push('Your voice is not standing out from the background noise');
  } else if (snr < 15) {
    status = 'warn';
    issues.push('Voice-to-noise ratio is marginal');
  }
  return {
    status,
    snrDb: Math.round(snr),
    issues,
    instructions: status === 'pass' ? ['Speech is clearly above background noise.'] : ['Get closer to the microphone and reduce background noise.'],
  };
}
