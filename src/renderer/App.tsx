const modules = [
  {
    title: 'לוח תוכניות',
    description: 'סקירה יומית של שיעורים, מחשבות ותזכורות לעבודה מקומית.',
    accent: 'from-cyan-500/20 to-sky-500/5',
  },
  {
    title: 'אשף יצירת תוכנית',
    description: 'תהליך שלב-אחר-שלב ליצירת מסגרת לימוד חדשה.',
    accent: 'from-violet-500/20 to-purple-500/5',
  },
  {
    title: 'מעקב דפים',
    description: 'רשימות היררכיות לפי מסכת, דף, רש"י ותוספות.',
    accent: 'from-emerald-500/20 to-teal-500/5',
  },
]

const hierarchy = ['מסכת', 'דף', 'רש"י', 'תוספות', 'הערות אישיות']

function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100" dir="rtl" lang="he">
      <div className="flex min-h-screen">
        <aside className="w-72 border-l border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-lg font-bold text-cyan-300">
              ת
            </div>
            <div>
              <p className="text-xs text-slate-400">Desktop Workspace</p>
              <h1 className="text-xl font-bold text-white">Talmudon</h1>
            </div>
          </div>

          <nav className="space-y-2 text-sm text-slate-300">
            {['לוח ראשי', 'תוכניות', 'רשימות', 'מחקרים', 'הגדרות'].map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition ${
                  index === 0
                    ? 'bg-slate-800 text-white shadow-inner shadow-slate-700/30'
                    : 'hover:bg-slate-800/80'
                }`}
                type="button"
              >
                <span>{item}</span>
                <span className="text-xs text-slate-500">0{index + 1}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            <p className="font-semibold">מצב אופליין</p>
            <p className="mt-1 text-emerald-100/80">כל הנתונים נשמרים מקומית, ללא תלות ברשת.</p>
          </div>
        </aside>

        <div className="flex-1 p-6 lg:p-8">
          <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-cyan-300">סביבת עבודה</p>
              <h2 className="mt-2 text-3xl font-bold text-white">ממשק דסקטופ מבוסס על Electron + React</h2>
            </div>
            <button
              type="button"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              יצירת תוכנית חדשה
            </button>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            {modules.map((module) => (
              <article
                key={module.title}
                className={`rounded-3xl border border-slate-800 bg-gradient-to-br ${module.accent} p-5 backdrop-blur-sm`}
              >
                <p className="text-sm text-slate-300">מודול</p>
                <h3 className="mt-3 text-xl font-bold text-white">{module.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-200/90">{module.description}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">לוח תוכניות מרכזי</h3>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200">
                  12 פעילויות
                </span>
              </div>

              <div className="space-y-3">
                {['הכנת מסכת בבא בתרא', 'סיכום דף מסכת סוכה', 'עיבוד רעיונות ליישום אישי'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-200">
                        {index + 1}
                      </div>
                      <p className="text-sm text-slate-200">{item}</p>
                    </div>
                    <span className="text-xs text-slate-400">{index === 0 ? 'פעיל' : 'בתכנון'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-xl font-bold text-white">היררכיית מסמכים</h3>
              <div className="mt-5 space-y-3">
                {hierarchy.map((level, index) => (
                  <div key={level} className="flex items-center gap-3 text-sm text-slate-200">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs text-cyan-300">
                      {index + 1}
                    </div>
                    <span>{level}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default App
