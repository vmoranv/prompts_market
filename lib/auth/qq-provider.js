export default function QQProvider(options) {
  return {
    id: "qq",
    name: "QQ",
    type: "oauth",
    wellKnown: "",
    authorization: {
      url: "https://graph.qq.com/oauth2.0/authorize",
      params: {
        response_type: "code",
        client_id: options.clientId,
        redirect_uri: options.callbackUrl,
        state: Math.random().toString(36).substring(2, 15),
        scope: options.scope || "get_user_info",
        display: "pc"
      }
    },
    token: {
      url: "https://graph.qq.com/oauth2.0/token",
      params: {
        grant_type: "authorization_code",
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: "",
        redirect_uri: options.callbackUrl
      },
      // 由于QQ返回的不是标准JSON，需要自定义处理
      async request({ provider, params, checks, client }) {
        const response = await fetch(`${provider.token.url}?${new URLSearchParams(params)}`)
        const text = await response.text()
        
        // 解析类似 access_token=xxx&expires_in=xxx&refresh_token=xxx 的响应
        const data = Object.fromEntries(new URLSearchParams(text))
        
        return { tokens: { access_token: data.access_token } }
      }
    },
    userinfo: {
      async request({ tokens, provider }) {
        // 1. 首先获取用户OpenID
        const openidResponse = await fetch(
          `https://graph.qq.com/oauth2.0/me?access_token=${tokens.access_token}&fmt=json`
        )
        const openidData = await openidResponse.json()
        
        if (!openidData.openid) {
          throw new Error("无法获取QQ用户的OpenID")
        }
        
        // 2. 然后获取用户信息
        const userInfoResponse = await fetch(
          `https://graph.qq.com/user/get_user_info?access_token=${tokens.access_token}&oauth_consumer_key=${provider.clientId}&openid=${openidData.openid}`
        )
        const userInfo = await userInfoResponse.json()
        
        return {
          sub: openidData.openid,
          name: userInfo.nickname,
          email: null,
          image: userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1,
          openid: openidData.openid
        }
      }
    },
    profile(profile) {
      return {
        id: profile.sub || profile.openid,
        name: profile.name,
        email: null,
        image: profile.image
      }
    },
    style: {
      logo: "https://qzonestyle.gtimg.cn/qzone/vas/opensns/res/img/Connect_logo_7.png",
      logoDark: "https://qzonestyle.gtimg.cn/qzone/vas/opensns/res/img/Connect_logo_7.png",
      bg: "#12B7F5",
      bgDark: "#12B7F5",
      text: "#fff",
      textDark: "#fff"
    },
    options
  }
} 