import type { InsurancePolicy } from "./types";

export type GeBasePlan = NonNullable<InsurancePolicy["geBasePlan"]>;
export type GeTotalCare2Tier = NonNullable<InsurancePolicy["geTotalCare2Tier"]>;

type BasePremiums = Record<Exclude<GeBasePlan, "None">, number>;
type RiderPremiums = readonly [p: number, prime: number, a: number, b: number, essential: number | null];

const baseBands: Array<{ max: number; scPr: BasePremiums; foreigner: Partial<BasePremiums> }> = [
  { max: 3, scPr: { "P Plus": 344.44, "P Prime": 192.93, "A Plus": 87.2, "B Plus": 61.04, Standard: 30.56 }, foreigner: { "P Plus": 544.44, "P Prime": 392.93, "A Plus": 287.2 } },
  { max: 18, scPr: { "P Plus": 312.83, "P Prime": 174.4, "A Plus": 85.02, "B Plus": 61.04, Standard: 30.56 }, foreigner: { "P Plus": 512.83, "P Prime": 374.4, "A Plus": 285.02 } },
  { max: 20, scPr: { "P Plus": 312.83, "P Prime": 174.4, "A Plus": 85.02, "B Plus": 61.04, Standard: 35.65 }, foreigner: { "P Plus": 512.83, "P Prime": 374.4, "A Plus": 285.02 } },
  { max: 25, scPr: { "P Plus": 391.31, "P Prime": 219.09, "A Plus": 103.55, "B Plus": 77.39, Standard: 35.65 }, foreigner: { "P Plus": 686.31, "P Prime": 514.09, "A Plus": 398.55 } },
  { max: 30, scPr: { "P Plus": 456.71, "P Prime": 255.06, "A Plus": 103.55, "B Plus": 77.39, Standard: 35.65 }, foreigner: { "P Plus": 751.71, "P Prime": 550.06, "A Plus": 398.55 } },
  { max: 35, scPr: { "P Plus": 631.11, "P Prime": 352.07, "A Plus": 134.07, "B Plus": 92.65, Standard: 53.99 }, foreigner: { "P Plus": 1134.11, "P Prime": 855.07, "A Plus": 637.07 } },
  { max: 40, scPr: { "P Plus": 680.16, "P Prime": 379.32, "A Plus": 152.6, "B Plus": 104.64, Standard: 53.99 }, foreigner: { "P Plus": 1183.16, "P Prime": 882.32, "A Plus": 655.6 } },
  { max: 45, scPr: { "P Plus": 1293.83, "P Prime": 721.58, "A Plus": 258.33, "B Plus": 165.68, Standard: 85.57 }, foreigner: { "P Plus": 1930.83, "P Prime": 1358.58, "A Plus": 895.33 } },
  { max: 50, scPr: { "P Plus": 1357.05, "P Prime": 757.55, "A Plus": 280.13, "B Plus": 175.49, Standard: 85.57 }, foreigner: { "P Plus": 1994.05, "P Prime": 1394.55, "A Plus": 917.13 } },
  { max: 55, scPr: { "P Plus": 2106.97, "P Prime": 1176.11, "A Plus": 384.77, "B Plus": 289.94, Standard: 115.11 }, foreigner: { "P Plus": 3009.97, "P Prime": 2079.11, "A Plus": 1287.77 } },
  { max: 60, scPr: { "P Plus": 2698.84, "P Prime": 1506.38, "A Plus": 536.28, "B Plus": 344.44, Standard: 115.11 }, foreigner: { "P Plus": 3601.84, "P Prime": 2409.38, "A Plus": 1439.28 } },
  { max: 63, scPr: { "P Plus": 3962.15, "P Prime": 2210.52, "A Plus": 694.33, "B Plus": 455.62, Standard: 235.32 }, foreigner: { "P Plus": 5093.15, "P Prime": 3341.52, "A Plus": 1825.33 } },
  { max: 65, scPr: { "P Plus": 3989.4, "P Prime": 2225.78, "A Plus": 882.9, "B Plus": 587.51, Standard: 235.32 }, foreigner: { "P Plus": 5120.4, "P Prime": 3356.78, "A Plus": 2013.9 } },
  { max: 68, scPr: { "P Plus": 5555.73, "P Prime": 3099.96, "A Plus": 1159.76, "B Plus": 758.64, Standard: 373.86 }, foreigner: { "P Plus": 6881.73, "P Prime": 4425.96, "A Plus": 2485.76 } },
  { max: 70, scPr: { "P Plus": 6003.72, "P Prime": 3350.66, "A Plus": 1464.96, "B Plus": 989.72, Standard: 373.86 }, foreigner: { "P Plus": 7329.72, "P Prime": 4676.66, "A Plus": 2790.96 } },
  { max: 73, scPr: { "P Plus": 6754.73, "P Prime": 3769.22, "A Plus": 1660.07, "B Plus": 1189.19, Standard: 597.97 }, foreigner: { "P Plus": 8397.73, "P Prime": 5412.22, "A Plus": 3303.07 } },
  { max: 75, scPr: { "P Plus": 8373.38, "P Prime": 4672.83, "A Plus": 2097.16, "B Plus": 1400.65, Standard: 681.5 }, foreigner: { "P Plus": 10189.38, "P Prime": 6488.83, "A Plus": 3913.16 } },
  { max: 78, scPr: { "P Plus": 9620.34, "P Prime": 5368.25, "A Plus": 2461.22, "B Plus": 1644.81, Standard: 732.44 }, foreigner: { "P Plus": 11647.34, "P Prime": 7395.25, "A Plus": 4488.22 } },
  { max: 100, scPr: { "P Plus": 13799.4, "P Prime": 7700.85, "A Plus": 5164.42, "B Plus": 3602.45, Standard: 1897.82 }, foreigner: { "P Plus": 16625.4, "P Prime": 10526.85, "A Plus": 7990.42 } }
];

const basePremiumOverrides: Record<string, { scPr: BasePremiums; foreigner: Partial<BasePremiums> }> = {
  "79": { scPr: { "P Plus": 11607.41, "P Prime": 6477.87, "A Plus": 2871.06, "B Plus": 1935.84, Standard: 782.36 }, foreigner: { "P Plus": 13794.41, "P Prime": 8664.87, "A Plus": 5058.06 } },
  "80": { scPr: { "P Plus": 11607.41, "P Prime": 6477.87, "A Plus": 2871.06, "B Plus": 1935.84, Standard: 782.36 }, foreigner: { "P Plus": 13794.41, "P Prime": 8664.87, "A Plus": 5058.06 } },
  "81": { scPr: { "P Plus": 12414.01, "P Prime": 6928.04, "A Plus": 2968.07, "B Plus": 2140.76, Standard: 818.01 }, foreigner: { "P Plus": 14717.01, "P Prime": 9231.04, "A Plus": 5271.07 } },
  "82": { scPr: { "P Plus": 12414.01, "P Prime": 6928.04, "A Plus": 2968.07, "B Plus": 2140.76, Standard: 818.01 }, foreigner: { "P Plus": 14717.01, "P Prime": 9231.04, "A Plus": 5271.07 } },
  "83": { scPr: { "P Plus": 12414.01, "P Prime": 6928.04, "A Plus": 2968.07, "B Plus": 2140.76, Standard: 818.01 }, foreigner: { "P Plus": 14717.01, "P Prime": 9231.04, "A Plus": 5271.07 } },
  "84": { scPr: { "P Plus": 13120.33, "P Prime": 7321.53, "A Plus": 3272.18, "B Plus": 2307.53, Standard: 1023.78 }, foreigner: { "P Plus": 15736.33, "P Prime": 9937.53, "A Plus": 5888.18 } },
  "85": { scPr: { "P Plus": 13120.33, "P Prime": 7321.53, "A Plus": 3272.18, "B Plus": 2307.53, Standard: 1023.78 }, foreigner: { "P Plus": 15736.33, "P Prime": 9937.53, "A Plus": 5888.18 } },
  "86": { scPr: { "P Plus": 13186.82, "P Prime": 7358.59, "A Plus": 3664.58, "B Plus": 2469.94, Standard: 1276.42 }, foreigner: { "P Plus": 15971.82, "P Prime": 10143.59, "A Plus": 6449.58 } },
  "87": { scPr: { "P Plus": 13186.82, "P Prime": 7358.59, "A Plus": 3664.58, "B Plus": 2469.94, Standard: 1276.42 }, foreigner: { "P Plus": 15971.82, "P Prime": 10143.59, "A Plus": 6449.58 } },
  "88": { scPr: { "P Plus": 13186.82, "P Prime": 7358.59, "A Plus": 3664.58, "B Plus": 2469.94, Standard: 1276.42 }, foreigner: { "P Plus": 15971.82, "P Prime": 10143.59, "A Plus": 6449.58 } },
  "89": { scPr: { "P Plus": 13329.61, "P Prime": 7438.16, "A Plus": 3804.1, "B Plus": 2675.95, Standard: 1330.41 }, foreigner: { "P Plus": 16114.61, "P Prime": 10223.16, "A Plus": 6589.1 } },
  "90": { scPr: { "P Plus": 13329.61, "P Prime": 7438.16, "A Plus": 3804.1, "B Plus": 2675.95, Standard: 1330.41 }, foreigner: { "P Plus": 16114.61, "P Prime": 10223.16, "A Plus": 6589.1 } },
  "91": { scPr: { "P Plus": 13473.49, "P Prime": 7518.82, "A Plus": 4062.43, "B Plus": 2863.43, Standard: 1436.36 }, foreigner: { "P Plus": 16299.49, "P Prime": 10344.82, "A Plus": 6888.43 } },
  "92": { scPr: { "P Plus": 13473.49, "P Prime": 7518.82, "A Plus": 4062.43, "B Plus": 2863.43, Standard: 1436.36 }, foreigner: { "P Plus": 16299.49, "P Prime": 10344.82, "A Plus": 6888.43 } },
  "93": { scPr: { "P Plus": 13473.49, "P Prime": 7518.82, "A Plus": 4062.43, "B Plus": 2863.43, Standard: 1436.36 }, foreigner: { "P Plus": 16299.49, "P Prime": 10344.82, "A Plus": 6888.43 } },
  "94": { scPr: { "P Plus": 13590.12, "P Prime": 7584.22, "A Plus": 4351.28, "B Plus": 3108.68, Standard: 1510.72 }, foreigner: { "P Plus": 16416.12, "P Prime": 10410.22, "A Plus": 7177.28 } },
  "95": { scPr: { "P Plus": 13590.12, "P Prime": 7584.22, "A Plus": 4351.28, "B Plus": 3108.68, Standard: 1510.72 }, foreigner: { "P Plus": 16416.12, "P Prime": 10410.22, "A Plus": 7177.28 } },
  "96": { scPr: { "P Plus": 13711.11, "P Prime": 7651.8, "A Plus": 4822.16, "B Plus": 3348.48, Standard: 1815.31 }, foreigner: { "P Plus": 16537.11, "P Prime": 10477.8, "A Plus": 7648.16 } },
  "97": { scPr: { "P Plus": 13711.11, "P Prime": 7651.8, "A Plus": 4822.16, "B Plus": 3348.48, Standard: 1815.31 }, foreigner: { "P Plus": 16537.11, "P Prime": 10477.8, "A Plus": 7648.16 } },
  "98": { scPr: { "P Plus": 13711.11, "P Prime": 7651.8, "A Plus": 4822.16, "B Plus": 3348.48, Standard: 1815.31 }, foreigner: { "P Plus": 16537.11, "P Prime": 10477.8, "A Plus": 7648.16 } }
};

const totalCare2PremiumRows: Record<string, RiderPremiums> = {
  "1": [977.73, 422.92, 118.81, 75.21, 148.24], "2": [977.73, 422.92, 118.81, 75.21, 127.53], "3": [977.73, 422.92, 118.81, 75.21, 110.09],
  "4": [842.57, 371.69, 77.39, 75.21, 94.83], "5": [842.57, 371.69, 77.39, 75.21, 81.75], "6": [842.57, 371.69, 77.39, 62.13, 75.21], "7": [842.57, 371.69, 77.39, 62.13, 77.39], "8": [842.57, 371.69, 77.39, 62.13, 78.48], "9": [842.57, 371.69, 77.39, 62.13, 80.66], "10": [842.57, 371.69, 77.39, 62.13, 85.02],
  "11": [842.57, 371.69, 77.39, 62.13, 87.2], "12": [842.57, 371.69, 77.39, 62.13, 89.38], "13": [842.57, 371.69, 77.39, 62.13, 91.56], "14": [842.57, 371.69, 77.39, 62.13, 93.74], "15": [842.57, 371.69, 77.39, 62.13, 97.01], "16": [842.57, 371.69, 77.39, 62.13, 99.19], "17": [842.57, 371.69, 77.39, 62.13, 103.55], "18": [842.57, 371.69, 77.39, 62.13, 105.73], "19": [842.57, 371.69, 77.39, 62.13, 109], "20": [842.57, 371.69, 77.39, 62.13, 113.36],
  "21": [887.26, 357.52, 88.29, 64.31, 115.54], "22": [887.26, 357.52, 88.29, 64.31, 119.9], "23": [887.26, 357.52, 88.29, 64.31, 123.17], "24": [887.26, 357.52, 88.29, 64.31, 126.44], "25": [887.26, 357.52, 88.29, 64.31, 127.53],
  "26": [893.8, 374.96, 88.29, 64.31, 128.62], "27": [893.8, 374.96, 88.29, 64.31, 128.62], "28": [893.8, 374.96, 88.29, 64.31, 129.71], "29": [893.8, 374.96, 88.29, 64.31, 129.71], "30": [893.8, 374.96, 88.29, 64.31, 130.8],
  "31": [935.22, 438.18, 109, 75.21, 130.8], "32": [935.22, 438.18, 109, 75.21, 130.8], "33": [935.22, 438.18, 109, 75.21, 131.89], "34": [935.22, 438.18, 109, 75.21, 131.89], "35": [935.22, 438.18, 109, 75.21, 134.07],
  "36": [1034.41, 468.7, 128.62, 89.38, 135.16], "37": [1034.41, 468.7, 128.62, 89.38, 136.25], "38": [1034.41, 468.7, 128.62, 89.38, 143.88], "39": [1034.41, 468.7, 128.62, 89.38, 144.97], "40": [1034.41, 468.7, 128.62, 89.38, 154.78],
  "41": [1507.47, 703.05, 167.86, 116.63, 162.41], "42": [1507.47, 703.05, 167.86, 116.63, 163.5], "43": [1507.47, 703.05, 167.86, 116.63, 166.77], "44": [1507.47, 703.05, 167.86, 116.63, 174.4], "45": [1507.47, 703.05, 167.86, 116.63, 176.58],
  "46": [1697.13, 827.31, 210.37, 144.97, 177.67], "47": [1697.13, 827.31, 210.37, 144.97, 189.66], "48": [1697.13, 827.31, 210.37, 144.97, 201.65], "49": [1697.13, 827.31, 210.37, 144.97, 213.64], "50": [1697.13, 827.31, 210.37, 144.97, 225.63],
  "51": [2334.78, 1297.1, 284.49, 196.2, 239.8], "52": [2334.78, 1297.1, 284.49, 196.2, 255.06], "53": [2334.78, 1297.1, 284.49, 196.2, 270.32], "54": [2334.78, 1297.1, 284.49, 196.2, 296.48], "55": [2334.78, 1297.1, 284.49, 196.2, 310.65],
  "56": [3217.68, 1706.94, 393.49, 271.41, 338.99], "57": [3217.68, 1706.94, 393.49, 271.41, 355.34], "58": [3217.68, 1706.94, 393.49, 271.41, 372.78], "59": [3217.68, 1706.94, 393.49, 271.41, 401.12], "60": [3217.68, 1706.94, 393.49, 271.41, 432.73],
  "61": [4532.22, 2225.78, 490.5, 340.08, 464.34], "62": [4532.22, 2225.78, 490.5, 340.08, 498.13], "63": [4532.22, 2225.78, 490.5, 340.08, 534.1], "64": [4993.29, 2401.27, 573.34, 395.67, 615.85], "65": [4993.29, 2401.27, 573.34, 395.67, 657.27],
  "66": [6035.33, 3009.49, 661.63, 457.8, 703.05], "67": [6035.33, 3009.49, 661.63, 457.8, 751.01], "68": [6035.33, 3009.49, 661.63, 457.8, 802.24], "69": [6530.19, 3321.23, 757.55, 523.2, 862.19], "70": [6530.19, 3321.23, 757.55, 523.2, 892.71],
  "71": [7414.18, 3732.16, 855.65, 590.78, 937.4], "72": [7414.18, 3732.16, 855.65, 590.78, 982.09], "73": [7414.18, 3732.16, 855.65, 590.78, 1031.14], "74": [8288.36, 4385.07, 966.83, 665.99, 1080.19], "75": [8288.36, 4385.07, 966.83, 665.99, 1132.51],
  "76": [8769.05, 4963.86, 1066.02, 735.75, 1189.19], "77": [8769.05, 4963.86, 1066.02, 735.75, 1244.78], "78": [8769.05, 4963.86, 1066.02, 735.75, 1305.82], "79": [9268.27, 5749.75, 1171.75, 807.69, 1372.31], "80": [9268.27, 5749.75, 1171.75, 807.69, 1437.71],
  "81": [9789.29, 6246.79, 1274.21, 879.63, 1507.47], "82": [9789.29, 6246.79, 1274.21, 879.63, 1581.59], "83": [9789.29, 6246.79, 1274.21, 879.63, 1657.89], "84": [10091.22, 6691.51, 1386.48, 952.66, 1739.64], "85": [10091.22, 6691.51, 1386.48, 952.66, 1823.57],
  "86": [10845.5, 6888.8, 1469.32, 1008.25, null], "87": [10845.5, 6888.8, 1469.32, 1008.25, null], "88": [10845.5, 6888.8, 1469.32, 1008.25, null], "89": [11715.32, 7167.84, 1472.59, 1064.93, null], "90": [11715.32, 7167.84, 1472.59, 1064.93, null],
  "91": [11973.65, 7220.16, 1495.48, 1117.25, null], "92": [11973.65, 7220.16, 1495.48, 1117.25, null], "93": [11973.65, 7220.16, 1495.48, 1117.25, null], "94": [12364.96, 7382.57, 1530.36, 1153.22, null], "95": [12364.96, 7382.57, 1530.36, 1153.22, null],
  "96": [12695.23, 7494.84, 1561.97, 1177.2, null], "97": [12695.23, 7494.84, 1561.97, 1177.2, null], "98": [12695.23, 7494.84, 1561.97, 1177.2, null], "99": [13135.59, 7589.67, 1567.42, 1188.1, null], "100": [13135.59, 7589.67, 1567.42, 1188.1, null], ">100": [13135.59, 7589.67, 1567.42, 1188.1, null]
};

function ageBand<T extends { max: number }>(rows: T[], age: number) {
  return rows.find((row) => age <= row.max) ?? rows.at(-1)!;
}

function ageKey(age: number) {
  const normalized = Math.max(1, Math.floor(age));
  return normalized > 100 ? ">100" : String(normalized);
}

export function geBasePremium(age: number, plan: GeBasePlan, residency: "Singapore Citizen / PR" | "Foreigner" = "Singapore Citizen / PR") {
  if (plan === "None") return 0;
  const normalizedAge = Math.max(1, Math.min(100, Math.floor(age)));
  const override = basePremiumOverrides[String(normalizedAge)];
  if (override) {
    const table = residency === "Foreigner" ? override.foreigner : override.scPr;
    return table[plan] ?? override.scPr[plan] ?? 0;
  }
  const band = ageBand(baseBands, normalizedAge);
  const table = residency === "Foreigner" ? band.foreigner : band.scPr;
  return table[plan] ?? band.scPr[plan] ?? 0;
}

const riderIndex: Record<Exclude<GeTotalCare2Tier, "None">, number> = { P: 0, Prime: 1, A: 2, B: 3 };

export function geRiderPremium(age: number, tier: GeTotalCare2Tier, plus2 = false) {
  const row = totalCare2PremiumRows[ageKey(age)] ?? totalCare2PremiumRows[">100"];
  const tierPremium = tier === "None" ? 0 : row[riderIndex[tier]] ?? 0;
  const essential = plus2 ? row[4] ?? 0 : 0;
  return tierPremium + essential;
}

export function geHospitalizationPremium(policy: InsurancePolicy, age: number, residency: "Singapore Citizen / PR" | "Foreigner" = "Singapore Citizen / PR") {
  const cash = geRiderPremium(age, policy.geTotalCare2Tier ?? "None", Boolean(policy.geTotalCarePlus2));
  const medisave = geBasePremium(age, policy.geBasePlan ?? "None", residency);
  return { cash, medisave, total: cash + medisave };
}
