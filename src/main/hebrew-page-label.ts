const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת']

function numberToHebrewLetters(n: number): string {
  let hundreds = Math.floor(n / 100)
  const tens = Math.floor((n % 100) / 10)
  const ones = n % 10

  let letters = ''
  while (hundreds > 0) {
    if (hundreds >= 4) {
      letters += 'ת'
      hundreds -= 4
    } else {
      letters += HUNDREDS[hundreds]
      hundreds = 0
    }
  }

  if (tens === 1 && ones === 5) {
    letters += 'טו'
  } else if (tens === 1 && ones === 6) {
    letters += 'טז'
  } else {
    letters += TENS[tens] + ONES[ones]
  }

  return letters
}

export function toHebrewPageLabel(pageNumber: number): string {
  const letters = numberToHebrewLetters(pageNumber)

  if (letters.length <= 1) {
    return `${letters}'`
  }

  return `${letters.slice(0, -1)}"${letters.slice(-1)}`
}
