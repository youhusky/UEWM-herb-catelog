import test from "node:test";
import assert from "node:assert/strict";

import { normalizeName, parseMapping, extractPrescriptionItems } from "../matcher.js";

test("normalizeName supports simplified/traditional and spacing cleanup", () => {
  assert.equal(normalizeName("當歸"), "当归");
  assert.equal(normalizeName("  Bai   Zhu  "), "bai zhu");
});

test("parseMapping supports CSV format, no-code rows, and note aliases", () => {
  // Includes a section header row and a no-code item to ensure parser robustness.
  const mappingText = `拼音 (Pinyin),编码 (Code),中文名 (Chinese Name),备注 (Notes)
N - Q,,,
Dang Gui,E-7-2,当归,
Bei Xing Ren,-,北杏仁,无编码
Rou Cong Rong,E-2-5,肉苁蓉,即大云`;

  const { aliasMap, aliases, matcher, aliasCandidates } = parseMapping(mappingText);

  assert.equal(aliasMap.get(normalizeName("当归")).code, "E72");
  assert.equal(aliasMap.get(normalizeName("大云")).code, "E25");
  assert.equal(aliasMap.get(normalizeName("北杏仁")).code, "");
  assert.ok(aliases.length >= 5);
  assert.ok(aliasCandidates.length >= 5);
  assert.ok(matcher instanceof RegExp);
});

test("extractPrescriptionItems matches exact, fuzzy typo, and traditional input", () => {
  // "石菖普" intentionally uses a typo to validate fuzzy fallback behavior.
  const mappingText = `拼音 (Pinyin),编码 (Code),中文名 (Chinese Name),备注 (Notes)
Dang Gui,E-7-2,当归,
Shi Chang Pu,F-7-4,石菖蒲,
Rou Cong Rong,E-2-5,肉苁蓉,即大云
Bei Xing Ren,-,北杏仁,无编码`;

  const parsed = parseMapping(mappingText);
  const prescription = `當歸 10克
石菖普 3克
大云 6克
北杏仁 5克`;

  const { items, unmatched } = extractPrescriptionItems(
    prescription,
    parsed.aliasMap,
    parsed.aliasCandidates,
    parsed.matcher
  );

  assert.equal(items.length, 4);
  const codeByName = new Map(items.map((item) => [item.rawName, item.code]));
  assert.equal(codeByName.get("當歸"), "E72");
  assert.equal(codeByName.get("石菖普"), "F74");
  assert.equal(codeByName.get("大云"), "E25");
  assert.equal(codeByName.get("北杏仁"), "");
  assert.equal(unmatched.length, 0);
});

test("extractPrescriptionItems returns unmatched content when no herb is recognized", () => {
  const mappingText = `B34, 艾绒 | Ai Rong`;
  const parsed = parseMapping(mappingText);
  const prescription = "不存在药材 3克";

  const { items, unmatched } = extractPrescriptionItems(
    prescription,
    parsed.aliasMap,
    parsed.aliasCandidates,
    parsed.matcher
  );

  assert.equal(items.length, 0);
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0], "不存在药材 3克");
});
