import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What Sakhi stores',
    body: [
      'Your first name, gender (optional), home city, and the style preferences you pick during setup.',
      'Photos you add: pictures of your clothes and outfit photos you log. These may include photos of you.',
      'Your wardrobe details (categories, colors, prices you enter), logged outfits, and purchase questions you ask.',
    ],
  },
  {
    title: 'Where it lives',
    body: [
      'Everything is stored in Sakhi\'s database and private image storage (hosted on Supabase). Your photos are accessible only through short-lived, signed links tied to your login — they are not public.',
      'Your data is yours alone: no other Sakhi user can see your wardrobe, photos, or preferences.',
    ],
  },
  {
    title: 'How AI is involved',
    body: [
      'Outfit suggestions, item recognition, purchase verdicts, and gap analysis are powered by Claude (Anthropic). To generate a response, your wardrobe list, relevant preferences, and — for photo features — the photo you submit are sent to Anthropic\'s API.',
      'Anthropic does not use this data to train its models, and retains API inputs only briefly for abuse prevention.',
      'Sakhi\'s advice is styling opinion, not financial guidance. You know your closet and your budget best.',
    ],
  },
  {
    title: 'What Sakhi doesn\'t do',
    body: [
      'No analytics, no ad trackers, no third-party scripts, no selling or sharing of your data. The only services that touch your data are Supabase (storage), Anthropic (AI responses), and Netlify (serving the app itself, which never sees your data).',
    ],
  },
  {
    title: 'Deleting your data',
    body: [
      'Profile → Delete account permanently removes everything: your photos from storage, your wardrobe, outfits, verdicts, preferences, and your login itself. There is no soft copy kept.',
    ],
  },
]

export function PrivacyScreen() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <div className="px-5 pt-4 pb-2 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft size={18} /> Back
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-7 pb-12">
        <h1 className="text-[22px] font-bold tracking-tight mb-2 mt-2">Privacy</h1>
        <p className="text-sm text-text-tertiary mb-7 leading-relaxed">
          Sakhi works because you trust her with your closet. Here's exactly how that trust is handled.
        </p>
        {SECTIONS.map(s => (
          <div key={s.title} className="mb-6">
            <h2 className="text-[15px] font-semibold text-text-primary mb-2">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-[13px] text-text-secondary leading-relaxed mb-2">{p}</p>
            ))}
          </div>
        ))}
        <p className="text-[12px] text-text-tertiary leading-relaxed mt-8">Last updated July 2026.</p>
      </div>
    </div>
  )
}
