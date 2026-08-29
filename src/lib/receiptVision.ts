import { openaiCompatChatCompletions, openaiCompatModel } from "./openaiCompatible";
import { parseSalaryJson } from "./salaryEmployees";

export const RECEIPT_VISION_PROMPT = `Bạn đọc ảnh biên lai viết tay (tiếng Việt). Trả về DUY NHẤT một JSON, không markdown, đúng schema v1 Chiphi:

{
  "employees": [
    { "name": "tên dòng hàng", "amount": 25000 }
  ],
  "summary": {
    "employee_count": 3,
    "total_amount": 150000
  }
}

Quy tắc:
- Mỗi dòng hàng/dịch vụ trên biên lai = một phần tử employees[] (cùng format JSON dán tay).
- amount là số nguyên VND, không dấu nghìn.
- summary.total_amount lấy tổng in/viết trên biên lai nếu có; không thì cộng employees[].amount.
- employee_count = số dòng employees.
- Bỏ qua tiêu đề, ngày, MST, chữ ký, dòng không có số tiền.`;

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Model trả về chuỗi rỗng");
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : trimmed).trim();
  const objStart = body.indexOf("{");
  const arrStart = body.indexOf("[");
  const arrayIsOuter = arrStart >= 0 && (objStart < 0 || arrStart < objStart);
  if (arrayIsOuter) {
    const arrEnd = body.lastIndexOf("]");
    if (arrEnd > arrStart) return body.slice(arrStart, arrEnd + 1);
  }
  const objEnd = body.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) return body.slice(objStart, objEnd + 1);
  throw new Error("Model không trả JSON");
}

export async function fileToJpegDataUrl(file: File, maxEdge = 1280, quality = 0.82): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const asIs = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không đọc được ảnh biên lai"));
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Không đọc được ảnh biên lai"));
      };
      reader.readAsDataURL(file);
    });
    return asIs;
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Không vẽ được ảnh biên lai");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export async function extractReceiptJsonFromImage(file: File): Promise<string> {
  const imageUrl = await fileToJpegDataUrl(file);
  const content = await openaiCompatChatCompletions({
    model: openaiCompatModel(),
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: RECEIPT_VISION_PROMPT },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  const jsonText = extractJsonText(content);
  const parsed = parseSalaryJson(jsonText);
  if (!parsed.ok) throw new Error(parsed.error);
  return jsonText;
}
