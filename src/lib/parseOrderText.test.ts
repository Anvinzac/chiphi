import { describe, expect, it } from "vitest";
import { formatParsedAmount, parseOrderLine, parseOrderText } from "./parseOrderText";

const SAMPLE = `10kg cà rốt
10kg khoai lang
1kg giá
1kg xà lách
10k lá quế
1kg rau muống bào
20k bắp chuối bào
5k ngò gai
0.5kg nấm rơm
3 bịch bào ngư xám
2 bịch nấm đùi gà lớn
8 bịch nấm linh chi nâu
0.5kg baro
1kg ngò rí
1kg chanh
5kg cải ngọt
10kg bắp cải tim
4 bó bồ ngót
20kg măng vàng ngâm
20kg rau muống
8kg đậu rồng
5kg đậu ve
10kg đu đủ
15kg cà tím`;

describe("parseOrderLine", () => {
  it("keeps kg glued to the number as a measure", () => {
    expect(parseOrderLine("10kg cà rốt")).toMatchObject({
      quantity: "10",
      unit: "kg",
      name: "cà rốt",
      mode: "measure",
    });
  });

  it("reads k as thousands of đồng, not a unit or part of the name", () => {
    expect(parseOrderLine("10k lá quế")).toMatchObject({
      name: "lá quế",
      mode: "money",
      moneyThousands: "10",
    });
    expect(parseOrderLine("20k bắp chuối bào")).toMatchObject({
      name: "bắp chuối bào",
      mode: "money",
      moneyThousands: "20",
    });
    expect(parseOrderLine("5k ngò gai")).toMatchObject({
      name: "ngò gai",
      mode: "money",
      moneyThousands: "5",
    });
  });

  it("does not treat kg as money", () => {
    expect(parseOrderLine("1kg giá")).toMatchObject({
      quantity: "1",
      unit: "kg",
      name: "giá",
      mode: "measure",
    });
  });

  it("parses bags and bunches", () => {
    expect(parseOrderLine("3 bịch bào ngư xám")).toMatchObject({
      quantity: "3",
      unit: "bịch",
      name: "bào ngư xám",
      mode: "measure",
    });
    expect(parseOrderLine("4 bó bồ ngót")).toMatchObject({
      quantity: "4",
      unit: "bó",
      name: "bồ ngót",
      mode: "measure",
    });
  });

  it("parses half kilos", () => {
    expect(parseOrderLine("0.5kg nấm rơm")).toMatchObject({
      quantity: "0.5",
      unit: "kg",
      name: "nấm rơm",
      mode: "measure",
    });
  });
});

describe("parseOrderText", () => {
  it("parses a mixed produce list and matches catalog names", () => {
    const catalog = [
      { id: "1", name: "Cà rốt", unit: "kg", reference_price: 18000 },
      { id: "2", name: "Rau muống", unit: "kg", reference_price: 8000 },
    ];
    const lines = parseOrderText(SAMPLE, catalog);
    expect(lines).toHaveLength(24);

    const carrot = lines.find(l => l.name === "cà rốt");
    expect(carrot?.matched?.id).toBe("1");
    expect(carrot?.mode).toBe("measure");

    const cinnamon = lines.find(l => l.normalizedName.includes("la que"));
    expect(cinnamon?.mode).toBe("money");
    expect(cinnamon?.moneyThousands).toBe("10");
    expect(cinnamon?.matched).toBeNull();

    const morningGlory = lines.find(l => l.name === "rau muống");
    expect(morningGlory?.matched?.id).toBe("2");
    expect(morningGlory?.quantity).toBe("20");

    const sliced = lines.find(l => l.name === "rau muống bào");
    expect(sliced?.matched).toBeNull();

    expect(formatParsedAmount(cinnamon!)).toBe("10k");
    expect(formatParsedAmount(carrot!)).toBe("10 kg");
  });
});
