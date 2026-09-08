import test from 'node:test';
import assert from 'node:assert/strict';
import {validChat,chatStyle,ATTACK_MODES} from '../client/assets/scripts/core/social.ts';
test('Chinese chat and protocol prefixes pass; controls, blank and >80 code units do not',()=>{
 for(const text of ['你好','/比奇旅人 你好','!!队伍消息','!~行会消息','!喊话','啊'.repeat(80)])assert.equal(validChat(text),true);
 for(const text of ['', '  ','啊'.repeat(81),'一\n二','一\t二','\u007f','\u0085'])assert.equal(validChat(text),false);
});
test('all six server mode IDs retain their protocol order; chat types remain distinguishable',()=>{
 assert.deepEqual(ATTACK_MODES,['和平攻击','编组攻击','行会攻击','行会战争','善恶攻击','全体攻击']);
 assert.equal(chatStyle(2).label,'系统');assert.equal(chatStyle(5).label,'队伍');assert.equal(chatStyle(8).label,'行会');assert.notEqual(chatStyle(6).fg,chatStyle(7).fg);
});
