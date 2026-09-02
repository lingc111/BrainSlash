import assert from 'node:assert/strict';
import test from 'node:test';
import { promptTextPresentation } from '../assets/Scripts/UI/TargetTypography.ts';

test('long gameplay prompts use the available prompt-paper width', () => {
    const short = promptTextPresentation('斩偶数');
    const medium = promptTextPresentation('人体气体交换器官');
    const long = promptTextPresentation('请选择：人体进行气体交换的主要器官');

    assert.equal(short.fontSize, 44);
    assert.equal(medium.fontSize, 34);
    assert.equal(long.fontSize, 28);
    assert.equal(long.width, 350);
    assert.ok(long.width > 258);
});
