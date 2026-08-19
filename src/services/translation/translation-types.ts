export type ProviderName='gemini'|'groq'|'google';
export interface TranslationRequest { text:string; targetLanguage:string; sourceLanguage?:string; protectedTerms?:string[] }
export interface TranslationResult { translatedText:string; sourceLanguage?:string; targetLanguage:string; provider:ProviderName; latencyMs:number; fallbackDepth:number; cached:boolean }
export interface MultiTranslationRequest { text:string; sourceLanguage?:string; targetLanguages:string[]; protectedTerms?:string[]; guildId?:string; channelId?:string; userId?:string }
export interface ProviderTranslation { text:string; sourceLanguage?:string; targetLanguage:string; latencyMs:number }
export interface ProviderBatchResult { translations:Map<string,ProviderTranslation>; sourceLanguage?:string; requestCount:number }
export interface MultiTranslationResult { sourceLanguage?:string; translations:Map<string,TranslationResult>; failedLanguages:string[]; totalLatencyMs:number; providerRequests:Record<ProviderName,number> }
export interface LanguageDetectionResult { language:string; confidence?:number }
export interface TranslationProvider { readonly name:ProviderName; isConfigured():boolean; translateMany(request:MultiTranslationRequest):Promise<ProviderBatchResult>; detectLanguage?(text:string):Promise<LanguageDetectionResult>; transliterate?(text:string,script:string):Promise<string> }
export class TranslationUnavailableError extends Error { constructor(){super('Translation is temporarily unavailable. Please try again later.');this.name='TranslationUnavailableError';} }
