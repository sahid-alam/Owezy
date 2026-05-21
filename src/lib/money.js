const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatINR(amount) {
  return INR.format(Number(amount))
}

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100)
}

export function toRupees(paise) {
  return paise / 100
}
