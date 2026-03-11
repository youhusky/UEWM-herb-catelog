const traditionalToSimplified = {
  體: "体", 當: "当", 歸: "归", 黃: "黄", 芪: "芪", 芩: "芩", 連: "连",
  葉: "叶", 藥: "药", 參: "参", 麥: "麦", 靈: "灵", 蘭: "兰", 蔥: "葱",
  蘇: "苏", 薑: "姜", 薏: "薏", 薺: "荠", 薊: "蓟", 蘚: "藓", 蘢: "茏",
  龍: "龙", 龜: "龟", 鱉: "鳖", 蠣: "蛎", 膠: "胶", 鵝: "鹅", 鷄: "鸡",
  朮: "术", 斷: "断", 歲: "岁", 澤: "泽", 萬: "万", 價: "价", 雞: "鸡",
  蕎: "荞", 鬱: "郁", 為: "为", 烏: "乌", 吳: "吴", 棗: "枣",
  蓮: "莲", 蘿: "萝", 蔔: "卜", 薈: "荟", 蒼: "苍", 瓊: "琼", 纈: "缬"
};

export function normalizeName(text) {
  const normalizedHan = text.replace(/[\u3400-\u9FFF]/g, (char) => {
    return traditionalToSimplified[char] || char;
  });

  return normalizedHan
    .toLowerCase()
    .replace(/[：:，,、|/\\()[\].'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function findFuzzyAlias(rawName, aliases, aliasMap) {
  const target = normalizeName(rawName);
  if (!target) return null;
  let best = null;
  let bestScore = Infinity;

  aliases.forEach((alias) => {
    const normalizedAlias = normalizeName(alias);
    if (!normalizedAlias) return;
    const distance = editDistance(target, normalizedAlias);
    if (distance < bestScore) {
      bestScore = distance;
      best = aliasMap.get(normalizedAlias) || null;
    }
  });

  const threshold = target.length <= 3 ? 1 : target.length <= 6 ? 2 : 3;
  return bestScore <= threshold ? best : null;
}

export function parseMapping(text) {
  const aliasMap = new Map();
  const aliases = [];
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    if (line.startsWith("拼音") || /^[A-Z]\s*-\s*[A-Z]/i.test(line)) {
      return;
    }

    const registerAliases = (code, aliasGroup) => {
      aliasGroup.forEach((alias) => {
        const name = normalizeName(alias);
        if (name) {
          aliasMap.set(name, { rawName: alias, code });
          aliases.push(alias);
        }
      });
    };

    // CSV format: pinyin, code, chinese, notes
    const csv = line.split(",").map((item) => item.trim());
    if (csv.length >= 3 && /^(?:-|[A-Za-z]-\d-\d|[A-Za-z0-9_-]+)$/.test(csv[1])) {
      const pinyin = csv[0];
      const rawCode = csv[1];
      const chinese = csv[2];
      const code = rawCode === "-" ? "" : rawCode.replace(/-/g, "");
      const aliasesFromNotes = csv[3]
        ? (csv[3].match(/(?:即|别名[:：]|又叫)([^,，]+)/g) || [])
            .map((piece) => piece.replace(/^(即|别名[:：]|又叫)/, "").trim())
            .filter(Boolean)
        : [];
      registerAliases(code, [chinese, pinyin, ...aliasesFromNotes]);
      return;
    }

    // Legacy format: code, chinese | pinyin | aliases
    const match = line.match(/^([A-Za-z0-9_-]+)[,\s，]+(.+)$/);
    if (!match) return;
    const code = match[1].trim().replace(/-/g, "");
    const aliasGroup = match[2].split("|").map((item) => item.trim()).filter(Boolean);
    registerAliases(code, aliasGroup);
  });

  const uniqueAliases = Array.from(new Set(aliases));
  const pattern = uniqueAliases
    .sort((a, b) => b.length - a.length)
    .map((alias) => escapeRegex(alias).replace(/\s+/g, "\\s*"))
    .join("|");

  return {
    aliasMap,
    aliases: uniqueAliases,
    matcher: pattern
      ? new RegExp(`(${pattern})\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)?\\s*(?:g|G|克)?`, "gi")
      : null
  };
}

export function extractPrescriptionItems(text, aliasMap, aliases, matcher) {
  if (!matcher) {
    return { items: [], unmatched: [] };
  }

  const items = [];
  let match;

  while ((match = matcher.exec(text)) !== null) {
    const rawName = match[1].trim();
    const amount = match[2] ? match[2].trim() : "";
    const name = normalizeName(rawName);
    const mapped = aliasMap.get(name);
    const fuzzyMapped = mapped || findFuzzyAlias(rawName, aliases, aliasMap);
    if (!fuzzyMapped) continue;

    items.push({
      rawName,
      code: fuzzyMapped.code,
      amount
    });
  }

  const unmatched = text
    .split(/\n+/)
    .flatMap((line) => line.split(/[，,、；;]+/))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const chunkMatcher = new RegExp(matcher.source, "i");
      return !chunkMatcher.test(item);
    });

  return { items, unmatched };
}
