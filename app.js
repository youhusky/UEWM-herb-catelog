import { parseMapping, extractPrescriptionItems } from "./matcher.js";

const mappingInput = document.getElementById("mappingInput");
const prescriptionInput = document.getElementById("prescriptionInput");
const resultBox = document.getElementById("resultBox");
const statusText = document.getElementById("statusText");
const countPill = document.getElementById("countPill");
const sortDefaultBtn = document.getElementById("sortDefaultBtn");
const sortAscBtn = document.getElementById("sortAscBtn");

const DEFAULT_MAPPING = "拼音 (Pinyin),编码 (Code),中文名 (Chinese Name),备注 (Notes)";
const MAPPING_DATA_URL = "./herb-mapping.txt";
let loadedMappingText = DEFAULT_MAPPING;
let currentSortMode = "default";
let lastItems = [];
let lastUnmatched = [];
let lastParsedMappingText = "";
let lastParsedMapping = null;

const DEFAULT_PRESCRIPTION = `白术 10克
土茯苓 12克
陈皮 6克

白术 土茯苓 陈皮

Bai Zhu 10g Chen Pi 6g`;

function normalizeCodeForSort(code) {
  const match = code.match(/^([A-Z])(\d+)$/i);
  if (!match) return { group: "Z", num: Number.MAX_SAFE_INTEGER };
  return { group: match[1].toUpperCase(), num: Number(match[2]) };
}

function compareByCodeAsc(a, b) {
  const codeA = a.code || "";
  const codeB = b.code || "";
  if (!codeA && !codeB) return 0;
  if (!codeA) return 1;
  if (!codeB) return -1;

  const na = normalizeCodeForSort(codeA);
  const nb = normalizeCodeForSort(codeB);
  if (na.group !== nb.group) return na.group.localeCompare(nb.group);
  if (na.num !== nb.num) return na.num - nb.num;
  return 0;
}

function renderFromState() {
  if (!lastItems.length) {
    resultBox.textContent = "没有识别到有效方子内容";
    statusText.textContent = "请输入药材名称，可带克数，也可以直接输入整段方子。";
    statusText.className = "status warn";
    countPill.textContent = "已匹配 0 味";
    return;
  }

  const displayItems =
    currentSortMode === "asc"
      ? [...lastItems].sort(compareByCodeAsc)
      : [...lastItems];

  const matched = displayItems.map((item) => {
    if (!item.code) {
      return item.amount
        ? `${item.rawName} 无编号 ${item.amount}克`
        : `${item.rawName} 无编号`;
    }
    return item.amount ? `${item.code} ${item.amount}克` : `${item.code} 未写克数`;
  });

  const sections = [];
  if (matched.length) {
    sections.push(matched.join("\n"));
  }
  if (lastUnmatched.length) {
    sections.push(`未匹配药材：\n${lastUnmatched.join("\n")}`);
  }

  resultBox.textContent = sections.join("\n\n");
  countPill.textContent = `已匹配 ${matched.length} 味`;

  if (lastUnmatched.length) {
    statusText.textContent = `有 ${lastUnmatched.length} 味药未找到编号，请补充编号表。`;
    statusText.className = "status warn";
  } else {
    statusText.textContent = `已完成转换，共 ${matched.length} 味药。`;
    statusText.className = "status ok";
  }
}

function setSortMode(mode) {
  currentSortMode = mode;
  sortDefaultBtn.classList.toggle("active", mode === "default");
  sortAscBtn.classList.toggle("active", mode === "asc");
  renderFromState();
}

function renderResult() {
  const mappingText = mappingInput.value;
  if (mappingText !== lastParsedMappingText || !lastParsedMapping) {
    lastParsedMapping = parseMapping(mappingText);
    lastParsedMappingText = mappingText;
  }

  const { aliasMap, aliasCandidates, matcher } = lastParsedMapping;
  const { items, unmatched } = extractPrescriptionItems(
    prescriptionInput.value,
    aliasMap,
    aliasCandidates,
    matcher
  );

  lastItems = items;
  lastUnmatched = unmatched;
  renderFromState();
}

document.getElementById("convertBtn").addEventListener("click", renderResult);
sortDefaultBtn.addEventListener("click", () => setSortMode("default"));
sortAscBtn.addEventListener("click", () => setSortMode("asc"));

document.getElementById("copyBtn").addEventListener("click", async () => {
  const text = resultBox.textContent.trim();
  if (!text || text === "点击“生成拿药结果”后显示") {
    statusText.textContent = "当前没有可复制的结果。";
    statusText.className = "status warn";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    statusText.textContent = "结果已复制到剪贴板。";
    statusText.className = "status ok";
  } catch (error) {
    statusText.textContent = "复制失败，请手动选中文本复制。";
    statusText.className = "status warn";
  }
});

document.getElementById("fillDemoBtn").addEventListener("click", () => {
  mappingInput.value = loadedMappingText;
});

document.getElementById("clearMappingBtn").addEventListener("click", () => {
  mappingInput.value = "";
  statusText.textContent = "";
  statusText.className = "status";
});

document.getElementById("clearPrescriptionBtn").addEventListener("click", () => {
  prescriptionInput.value = "";
  resultBox.textContent = "点击“生成拿药结果”后显示";
  countPill.textContent = "已匹配 0 味";
  statusText.textContent = "";
  statusText.className = "status";
});

async function loadMappingData() {
  try {
    const response = await fetch(MAPPING_DATA_URL, { cache: "no-store" });
    if (response.ok) {
      const text = await response.text();
      if (text.trim()) {
        loadedMappingText = text;
      }
    }
  } catch (error) {
    // Keep DEFAULT_MAPPING fallback when file loading is unavailable.
  }
  mappingInput.value = loadedMappingText;
}

async function initializePage() {
  await loadMappingData();
  prescriptionInput.value = DEFAULT_PRESCRIPTION;
  setSortMode("default");
  renderResult();
}

initializePage();
