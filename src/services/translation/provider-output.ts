export function stripTranslationDelimiters(text:string):string{return text.replace(/^\s*<{2,}\s*/u,'').replace(/\s*>{2,}\s*$/u,'');}
