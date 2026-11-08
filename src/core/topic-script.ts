/**
 * Free offline topic-to-script templates.
 * This is deterministic writing assistance, not a generative AI model.
 */
export interface TopicScript {
  topic: string;
  language: "en" | "ar";
  script: string;
}

const ACTION_PATTERN = /\b(walk|walks|walking|run|runs|running|jump|jumps|jumping|wave|waves|waving|pick|picks|picked|place|places|placing|show|shows|explain|explains|discover|discovers|explore|explores|starts|begins|ends|moves|looks|finds|learns|is|are|was|were|can|will|why|how)\b|يمشي|يركض|يقفز|يشرح|يكتشف|يعرض|يبدأ|ينتهي|لماذا|كيف|هو|هي/iu;

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/u.test(text);
}

/** Expand a short topic into a four-beat educational narration outline. */
export function createTopicScript(input: string): TopicScript | null {
  const topic = input.trim().replace(/\s+/g, " ");
  if (!topic || topic.length > 120 || topic.split(/\s+/).length > 8 || ACTION_PATTERN.test(topic)) return null;

  const language = isArabic(topic) ? "ar" : "en";
  if (language === "ar") {
    return {
      topic,
      language,
      script: [
        `هل تساءلت يوماً عن ${topic}؟ في هذا الفيديو سنكتشف الفكرة بطريقة بسيطة وممتعة.`,
        `أولاً، ما ${topic}؟ إنها ظاهرة تستحق أن نفهم كيف تعمل وما الذي يجعلها مميزة.`,
        `تخيّل مثالاً بسيطاً: عندما نلاحظ ${topic}، يمكننا ربط الفكرة بما نراه في العالم من حولنا.`,
        `والآن أصبحت الصورة أوضح! تذكّر أن فهم ${topic} يبدأ بطرح الأسئلة والبحث عن الأدلة.`,
      ].join("\n"),
    };
  }

  return {
    topic,
    language,
    script: [
      `Have you ever wondered about ${topic}? Today, we will explore the idea in a simple and surprising way.`,
      `First, what is ${topic}? It is a fascinating subject, and understanding the basic idea helps everything make sense.`,
      `Imagine a simple example: when we look at ${topic}, we can connect the explanation to things we observe in the world around us.`,
      `Now the big picture is clearer. Keep asking questions about ${topic}, and look for evidence that explains how it works.`,
    ].join("\n"),
  };
}
