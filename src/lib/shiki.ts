import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

export const highlighterPromise = createHighlighterCore({
  themes: [
    import('@shikijs/themes/github-light'),
    import('@shikijs/themes/github-dark'),
  ],
  langs: [
    import('@shikijs/langs/typescript'),
    import('@shikijs/langs/javascript'),
    import('@shikijs/langs/python'),
    import('@shikijs/langs/rust'),
    import('@shikijs/langs/go'),
    import('@shikijs/langs/bash'),
    import('@shikijs/langs/json'),
    import('@shikijs/langs/yaml'),
    import('@shikijs/langs/markdown'),
    import('@shikijs/langs/css'),
    import('@shikijs/langs/html'),
    import('@shikijs/langs/sql'),
    import('@shikijs/langs/shell'),
  ],
  engine: createJavaScriptRegexEngine(),
})

/** Resolved highlighter — call after await highlighterPromise */
export type Highlighter = Awaited<typeof highlighterPromise>
