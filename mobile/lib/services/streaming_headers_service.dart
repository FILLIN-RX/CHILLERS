/// Streaming Headers Service
/// 
/// Centralized service for managing HTTP headers for different streaming providers.
/// This utility handles all referer and origin headers based on the stream URL,
/// keeping the video player clean and maintainable.
///
/// Supports all backends providers:
/// - Direct (mongodb, uqload, vidzy, doodstream, streamtape)
/// - FrenchStream
/// - Flemmix
/// - OmniSave
/// - AnimeKai
/// - VidLink
/// - Otaku

class StreamingHeadersService {
  // Singleton pattern
  static final StreamingHeadersService _instance = StreamingHeadersService._internal();

  factory StreamingHeadersService() {
    return _instance;
  }

  StreamingHeadersService._internal();

  /// Provider-specific header configurations
  /// Maps domain keywords to their required headers
  static const Map<String, Map<String, String>> _providerHeaders = {
    // ─── Doodstream & Variants ───
    'doodstream.com': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.to': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.sh': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.so': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.cx': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.la': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.wf': {
      'Referer': 'https://doodstream.com/',
    },
    'dood.pm': {
      'Referer': 'https://doodstream.com/',
    },
    'd000d.com': {
      'Referer': 'https://doodstream.com/',
    },
    'd0000d.com': {
      'Referer': 'https://doodstream.com/',
    },
    'playmogo.com': {
      'Referer': 'https://doodstream.com/',
    },
    'ds2play': {
      'Referer': 'https://doodstream.com/',
    },

    // ─── Vidzy & Variants ───
    'vidzy.cc': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },
    'vidzy.org': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },
    'vidzy.xyz': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },
    'vidzy.co': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },
    'vidzy.tv': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },
    'vidzy.top': {
      'Referer': 'https://vidzy.cc/',
      'Origin': 'https://vidzy.cc',
    },

    // ─── UqLoad ───
    'uqload.is': {
      'Referer': 'https://uqload.is/',
      'Origin': 'https://uqload.is',
    },
    'uqload.com': {
      'Referer': 'https://uqload.is/',
      'Origin': 'https://uqload.is',
    },

    // ─── StreamTape ───
    'streamtape.com': {
      'Referer': 'https://streamtape.com/',
    },

    // ─── LuluVid & Variants ───
    'luluvid.com': {
      'Referer': 'https://luluvid.com/',
    },
    'luluvdo.com': {
      'Referer': 'https://luluvdo.com/',
    },
    'lulutv.com': {
      'Referer': 'https://luluvid.com/',
    },

    // ─── VoE ───
    'voe.sx': {
      'Referer': 'https://voe.sx/',
    },
    'rebeccapracticeloss': {
      'Referer': 'https://voe.sx/',
    },

    // ─── Flemmix ───
    'flemmix.party': {
      'Referer': 'https://flemmix.party/',
    },

    // ─── French-Stream ───
    'french-stream.net': {
      'Referer': 'https://french-stream.net/',
    },
    'frenchstream': {
      'Referer': 'https://french-stream.net/',
    },

    // ─── VidLink ───
    'vidlink.pro': {
      'Referer': 'https://vidlink.pro/',
      'Origin': 'https://vidlink.pro',
    },

    // ─── AnimeKai ───
    'animekai.to': {
      'Referer': 'https://animekai.to/',
      'Origin': 'https://animekai.to',
    },

    // ─── OmniSave / Other Sources ───
    'omnisave': {
      'Referer': 'https://omnisave.com/',
    },

    // ─── Direct Video CDN (Preserved) ───
    'videodownloader.site': {
      'Referer': 'https://videodownloader.site/',
      'Origin': 'https://videodownloader.site',
    },
    'hakunaymatata': {
      'Referer': 'https://videodownloader.site/',
      'Origin': 'https://videodownloader.site',
    },
    'bcdn': {
      'Referer': 'https://videodownloader.site/',
      'Origin': 'https://videodownloader.site',
    },
  };

  /// Standard user agent for all requests
  static const String _standardUserAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  /// Get HTTP headers for a given streaming URL
  /// 
  /// This method identifies the streaming provider based on the URL
  /// and returns appropriate HTTP headers (User-Agent, Referer, Origin).
  /// 
  /// Parameters:
  ///   - url: The streaming URL to get headers for
  /// 
  /// Returns:
  ///   A map of HTTP headers suitable for requesting this URL
  Map<String, String> getHeadersForUrl(String url) {
    final headers = <String, String>{
      'User-Agent': _standardUserAgent,
    };

    if (url.isEmpty) {
      return headers;
    }

    final lower = url.toLowerCase();

    // Find matching provider and apply its headers
    for (final provider in _providerHeaders.entries) {
      if (lower.contains(provider.key)) {
        headers.addAll(provider.value);
        break;
      }
    }

    return headers;
  }

  /// Get just the referer header for a URL (if applicable)
  /// 
  /// Returns null if no referer is needed for this provider
  String? getRefererForUrl(String url) {
    if (url.isEmpty) return null;
    final headers = getHeadersForUrl(url);
    return headers['Referer'];
  }

  /// Check if a URL requires specific headers
  /// 
  /// Returns true if the URL belongs to a known streaming provider
  bool requiresSpecialHeaders(String url) {
    if (url.isEmpty) return false;
    final lower = url.toLowerCase();
    return _providerHeaders.keys.any((provider) => lower.contains(provider));
  }

  /// Get provider name from URL
  /// 
  /// Returns the provider name if recognized, otherwise returns null
  String? getProviderFromUrl(String url) {
    if (url.isEmpty) return null;
    final lower = url.toLowerCase();
    
    for (final provider in _providerHeaders.keys) {
      if (lower.contains(provider)) {
        return provider;
      }
    }
    
    return null;
  }

  /// Check if URL is from a known streaming provider
  /// 
  /// List of supported providers:
  /// - HakunayMatata / BCDN / VideoDownloader
  /// - Vidzy
  /// - UqLoad
  /// - Dood / DS2Play / PlayMogo / D000
  /// - LuluVid / LuluVDo / LuluTV
  /// - VoE
  /// - StreamTape
  /// - Flemmix
  /// - French-Stream / FrenchStream
  bool isKnownProvider(String url) {
    return getProviderFromUrl(url) != null;
  }

  /// Get list of all supported providers
  List<String> getSupportedProviders() {
    return _providerHeaders.keys.toList();
  }
}

/// Singleton instance for easy access
final streamingHeadersService = StreamingHeadersService();
