import { parseMapping, extractPrescriptionItems } from "./matcher.js";

const mappingInput = document.getElementById("mappingInput");
const prescriptionInput = document.getElementById("prescriptionInput");
const resultBox = document.getElementById("resultBox");
const statusText = document.getElementById("statusText");
const countPill = document.getElementById("countPill");

const DEFAULT_MAPPING = "拼音 (Pinyin),编码 (Code),中文名 (Chinese Name),备注 (Notes)";
const MAPPING_DATA_URL = "./herb-mapping.txt";
let loadedMappingText = DEFAULT_MAPPING;

const DEFAULT_PRESCRIPTION = `白术 10克
土茯苓 12克
陈皮 6克

或直接输入：
白术 土茯苓 陈皮

或整段输入：
Bai Zhu 10g Chen Pi 6g`;

function renderResult() {
  const { aliasMap, aliases, matcher } = parseMapping(mappingInput.value);
  const { items, unmatched } = extractPrescriptionItems(
    prescriptionInput.value,
    aliasMap,
    aliases,
    matcher
  );

  const matched = items.map((item) => {
    if (!item.code) {
      return item.amount
        ? `${item.rawName} 无编号 ${item.amount}克`
        : `${item.rawName} 无编号`;
    }
    return item.amount ? `${item.code} ${item.amount}克` : `${item.code} 未写克数`;
  });

  if (!items.length) {
    resultBox.textContent = "没有识别到有效方子内容";
    statusText.textContent = "请输入药材名称，可带克数，也可以直接输入整段方子。";
    statusText.className = "status warn";
    countPill.textContent = "已匹配 0 味";
    return;
  }

  const sections = [];
  if (matched.length) {
    sections.push(matched.join("\n"));
  }
  if (unmatched.length) {
    sections.push(`未匹配药材：\n${unmatched.join("\n")}`);
  }

  resultBox.textContent = sections.join("\n\n");
  countPill.textContent = `已匹配 ${matched.length} 味`;

  if (unmatched.length) {
    statusText.textContent = `有 ${unmatched.length} 味药未找到编号，请补充编号表。`;
    statusText.className = "status warn";
  } else {
    statusText.textContent = `已完成转换，共 ${matched.length} 味药。`;
    statusText.className = "status ok";
  }
}

document.getElementById("convertBtn").addEventListener("click", renderResult);

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
  renderResult();
}

initializePage();
