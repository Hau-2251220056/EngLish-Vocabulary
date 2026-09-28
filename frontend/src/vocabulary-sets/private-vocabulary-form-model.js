export function privateVocabularyFormValues(value = {}) {
  return {
    word: value.word ?? "",
    phonetic: value.phonetic ?? "",
    meanings: Array.isArray(value.meanings) && value.meanings.length > 0
      ? value.meanings.map((meaning) => ({
          ...(meaning.id ? { id: meaning.id } : {}),
          part_of_speech: meaning.part_of_speech ?? "",
          meaning_vi: meaning.meaning_vi ?? "",
          context: meaning.context ?? "",
          cefr_level: meaning.cefr_level ?? "",
          examples: (meaning.examples ?? []).map((example) => ({
            ...(example.id ? { id: example.id } : {}),
            example_en: example.example_en ?? "",
            example_vi: example.example_vi ?? "",
          })),
        }))
      : [blankMeaning()],
  };
}

export function validatePrivateVocabulary(values) {
  const errors = {};
  if (!values.word.trim()) errors.word = "Từ vựng là bắt buộc.";
  if (!Array.isArray(values.meanings) || values.meanings.length === 0) {
    errors.meanings = "Cần ít nhất một nghĩa.";
    return errors;
  }
  values.meanings.forEach((meaning, index) => {
    if (!meaning.part_of_speech.trim()) errors[`part-${index}`] = "Loại từ là bắt buộc.";
    if (!meaning.meaning_vi.trim()) errors[`meaning-${index}`] = "Nghĩa tiếng Việt là bắt buộc.";
    meaning.examples.forEach((example, exampleIndex) => {
      if (!example.example_en.trim()) errors[`example-${index}-${exampleIndex}`] = "Ví dụ tiếng Anh là bắt buộc.";
    });
  });
  return errors;
}

export function serializePrivateVocabulary(values) {
  return {
    word: values.word.trim(),
    phonetic: values.phonetic.trim() || null,
    meanings: values.meanings.map((meaning) => ({
      ...(meaning.id ? { id: meaning.id } : {}),
      part_of_speech: meaning.part_of_speech.trim(),
      meaning_vi: meaning.meaning_vi.trim(),
      context: meaning.context.trim() || null,
      cefr_level: meaning.cefr_level || null,
      examples: meaning.examples.map((example) => ({
        ...(example.id ? { id: example.id } : {}),
        example_en: example.example_en.trim(),
        example_vi: example.example_vi.trim() || null,
      })),
    })),
  };
}

function blankMeaning() {
  return { part_of_speech: "", meaning_vi: "", context: "", cefr_level: "", examples: [] };
}
