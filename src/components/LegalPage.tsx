import { useEffect } from 'react'

type LegalPageProps = {
  page: 'privacy' | 'terms'
}

const pageContent = {
  privacy: {
    title: 'Privacy Policy',
    description: 'Learn how information may be handled when you use VoxAgent.',
  },
  terms: {
    title: 'Terms and Conditions',
    description: 'Read the terms for using the VoxAgent application.',
  },
}

function updateMeta(selector: string, attribute: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector)
  element?.setAttribute(attribute, value)
}

export default function LegalPage({ page }: LegalPageProps) {
  const content = pageContent[page]

  useEffect(() => {
    const fullTitle = `${content.title} | VoxAgent`
    document.title = fullTitle
    updateMeta('meta[name="description"]', 'content', content.description)
    updateMeta('meta[property="og:title"]', 'content', fullTitle)
    updateMeta('meta[property="og:description"]', 'content', content.description)
  }, [content])

  return (
    <main className="min-h-screen bg-white px-5 py-12 text-[#171923] sm:px-8">
      <article className="mx-auto max-w-3xl pb-24">
        <a className="text-sm font-medium text-[#5558c9] hover:underline" href="/">
          VoxAgent
        </a>
        <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>

        {page === 'privacy' ? (
          <div className="mt-8 space-y-7 text-base leading-7 text-[#454957]">
            <p>This page describes, in general terms, how information may be handled when you use the application.</p>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Information and use</h2>
              <p className="mt-2">Information you provide, account information, and information needed to operate features may be processed to provide and maintain the application, respond to requests, and protect its operation.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Storage and sharing</h2>
              <p className="mt-2">Information may be stored for operational purposes and may be handled by service providers involved in delivering application features. Their handling may be subject to their own terms and policies.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Your choices and updates</h2>
              <p className="mt-2">Avoid submitting information you are not authorized to share. This policy may be updated as the application changes; the current version will appear on this page.</p>
            </section>
          </div>
        ) : (
          <div className="mt-8 space-y-7 text-base leading-7 text-[#454957]">
            <p>By using the application, you agree to these general terms. If you do not agree, do not use the application.</p>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Using the application</h2>
              <p className="mt-2">Use the application lawfully and do not interfere with its operation or attempt unauthorized access. You are responsible for activity carried out through your account and for having permission to submit any content you provide.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Availability and other services</h2>
              <p className="mt-2">Features and availability may change. Some features may involve third-party services, which may be subject to separate terms and policies.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[#171923]">Updates</h2>
              <p className="mt-2">These terms may be updated as the application changes. The current version will appear on this page.</p>
            </section>
          </div>
        )}

        <nav aria-label="Legal pages" className="mt-10 flex gap-5 border-t border-[#e5e7eb] pt-5 text-sm">
          <a className="text-[#5558c9] hover:underline" href="/privacy-policy">Privacy Policy</a>
          <a className="text-[#5558c9] hover:underline" href="/terms">Terms and Conditions</a>
        </nav>
      </article>
    </main>
  )
}
