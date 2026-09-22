import { describe, expect, it } from 'vitest';
import { parseTaskTags, serializeTaskTags, taskTagsInclude } from './taskTags';

describe('task tags', () => {
  it('normalizes comma-separated and JSON-array values', () => {
    expect(parseTaskTags(' device:pi5, ssh, device:pi5 ')).toEqual(['device:pi5', 'ssh']);
    expect(parseTaskTags('["device:oracle","deploy"]')).toEqual(['device:oracle', 'deploy']);
    expect(serializeTaskTags(['device:pi5', 'ssh'])).toBe('device:pi5, ssh');
  });

  it('matches device tags without case-sensitive surprises', () => {
    expect(taskTagsInclude('device:Netcup, build', 'device:netcup')).toBe(true);
    expect(taskTagsInclude('device:pi5', 'device:oracle')).toBe(false);
  });
});
