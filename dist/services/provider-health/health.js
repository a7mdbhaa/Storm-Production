export class ProviderHealth {
    threshold;
    windowMs;
    cooldownMs;
    states = new Map();
    constructor(threshold = 3, windowMs = 60_000, cooldownMs = 60_000) {
        this.threshold = threshold;
        this.windowMs = windowMs;
        this.cooldownMs = cooldownMs;
    }
    state(name) { let s = this.states.get(name); if (!s) {
        s = { failures: [], disabledUntil: 0, rateLimited: false };
        this.states.set(name, s);
    } return s; }
    canUse(name) { return Date.now() >= this.state(name).disabledUntil; }
    success(name) { const s = this.state(name); s.failures = []; s.disabledUntil = 0; s.rateLimited = false; s.lastSuccess = Date.now(); }
    failure(name, rateLimited = false) { const s = this.state(name), now = Date.now(); s.lastFailure = now; s.rateLimited = rateLimited; s.failures = s.failures.filter(x => now - x < this.windowMs); s.failures.push(now); if (rateLimited || s.failures.length >= this.threshold)
        s.disabledUntil = now + this.cooldownMs; }
    status(name, configured) { if (!configured)
        return 'Not configured'; const s = this.state(name); if (s.disabledUntil > Date.now())
        return s.rateLimited ? 'Rate limited' : 'Temporarily unavailable'; return 'Healthy'; }
}
//# sourceMappingURL=health.js.map