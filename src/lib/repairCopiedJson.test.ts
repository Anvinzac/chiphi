import { describe, expect, it } from "vitest";
import { repairCopiedJson } from "./repairCopiedJson";

const VALID = '{"employees":[{"name":"Rau","amount":25000}],"summary":{"total_amount":25000}}';

describe("repairCopiedJson", () => {
  it("leaves valid JSON alone (aside from trimming)", () => {
    expect(repairCopiedJson(`  ${VALID}  `)).toBe(VALID);
    expect(JSON.parse(repairCopiedJson(VALID))).toMatchObject({
      summary: { total_amount: 25_000 },
    });
  });

  it("unwraps markdown fences and surrounding chatter", () => {
    const wrapped = `here\n\`\`\`json\n${VALID}\n\`\`\`\nthanks`;
    expect(JSON.parse(repairCopiedJson(wrapped))).toEqual(JSON.parse(VALID));
  });

  it("fixes smart quotes, trailing commas, and unquoted keys", () => {
    const messy = `{employees:[{name:“Rau”,amount:25000,},],summary:{total_amount:25000,},}`;
    expect(JSON.parse(repairCopiedJson(messy))).toEqual(JSON.parse(VALID));
  });

  it("strips leftover markdown/WhatsApp asterisks around keys and quotes", () => {
    const starred =
      '*{*"employees"*: [*{"name": *"Rau"*, "amount": 25000*}*]*, *"summary"*: {*"total_amount"*: 25000*}*}*';
    expect(JSON.parse(repairCopiedJson(starred))).toEqual(JSON.parse(VALID));
  });

  it("closes a truncated object copied without the last brace", () => {
    const cut = '{"employees":[{"name":"Rau","amount":25000}],"summary":{"total_amount":25000}';
    expect(JSON.parse(repairCopiedJson(cut))).toEqual(JSON.parse(VALID));
  });

  it("converts single-quoted JSON", () => {
    const single = "{'employees':[{'name':'Rau','amount':25000}],'summary':{'total_amount':25000}}";
    expect(JSON.parse(repairCopiedJson(single))).toEqual(JSON.parse(VALID));
  });
});
