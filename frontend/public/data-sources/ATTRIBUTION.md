# ELVocab data-source attribution

This directory contains the public attribution notices and the narrowly scoped
Octanove-derived distribution artifact used by the ELVocab educational thesis
demo.

## Octanove-derived C1 artifact

`elvocab-octanove-derived-c1.csv` contains exactly 145 C1 entries selected from
*Octanove Vocabulary Profile C1/C2 Version 1.0*, created by Octanove Labs and
distributed by Open Language Profiles:
https://github.com/openlanguageprofiles/olp-en-cefrj

The source is licensed under CC BY-SA 4.0. ELVocab selected C1 rows, normalized
metadata, and added Vietnamese meanings and bilingual learning examples. The
artifact and adaptations within it are distributed under CC BY-SA 4.0; see
`CC-BY-SA-4.0.txt` and https://creativecommons.org/licenses/by-sa/4.0/.

This ShareAlike notice applies to this Octanove-derived artifact. It does not
purport to license the entire ELVocab application, CEFR-J content, or unrelated
data under CC BY-SA 4.0.

The CSV deliberately excludes IPA transcriptions, CEFR-J-derived entries, user
data, database identifiers, and learning progress.

## CEFR-J

ELVocab's non-public working dataset also includes selected A1-B2 entries from
*The CEFR-J Wordlist Version 1.6*, compiled by Yukio Tono, Tono Laboratory,
Tokyo University of Foreign Studies: https://cefr-j.org/download_eng.html.
ELVocab selected and normalized entries and added Vietnamese meanings, examples,
translations, and pronunciation information. CEFR-J content is not included in
the downloadable CSV in this directory. Any separate permission requirements
remain unresolved and this notice does not claim clearance or endorsement.

## Pronunciation notices

Some editorial IPA work was derived from ARPABET in the CMU Pronouncing
Dictionary. Its notice is preserved in `CMUDICT-LICENSE.txt`. The `ipa-dict`
project was used only for automated QA comparison; agreement with that
CMUdict-derived source is not independent dictionary verification.

Source links:

- https://github.com/cmusphinx/cmudict
- https://github.com/open-dict-data/ipa-dict

The downloadable CSV contains no IPA field.
