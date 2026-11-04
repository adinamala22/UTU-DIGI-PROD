export function formatINR(paise: number, opts: { decimals?: boolean } = {}) {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals || rupees % 1 !== 0 ? 2 : 0,
    minimumFractionDigits: 0,
  }).format(rupees);
}

export const toPaise = (rupees: number | string) => Math.round(Number(rupees) * 100);
export const toRupeeString = (paise: number) => (paise / 100).toFixed(2);

export function percentOff(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
