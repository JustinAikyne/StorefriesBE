const crypto = require('crypto');
const oauth1a = require('oauth-1.0a');

class AuthHelper {
    static getAuthHeaderForRequest(request, CONSUMERKEY, CONSUMERSECRET) {
        const oauth = oauth1a({
            consumer: { key: CONSUMERKEY, secret: CONSUMERSECRET },
            signature_method: 'HMAC-SHA1',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha1', key)
                    .update(base_string)
                    .digest('base64')
            },
        })

        const authorization = oauth.authorize(request, {
            // key: TOKENKEY,
            // secret: TOKENSECRET,
        });

        return oauth.toHeader(authorization);
    }
}

module.exports = AuthHelper;