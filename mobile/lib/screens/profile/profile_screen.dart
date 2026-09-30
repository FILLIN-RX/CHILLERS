import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../models/user_model.dart';
import '../../models/subscription_plan.dart';
import '../../services/storage_service.dart';
import '../../services/api_service.dart';
import '../auth/auth_screen.dart';
import '../history/history_screen.dart';
import '../favorites/favorites_screen.dart';
import '../playlists/playlists_screen.dart';
import '../../widgets/upgrade_modal.dart';
import '../../services/biometric_service.dart';
import '../../services/notification_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final StorageService _storage = StorageService();
  final ApiService _apiService = ApiService();

  UserModel? _currentUser;
  List<SubscriptionPlanModel> _plans = [];
  bool _isLoading = true;

  // Settings
  bool _biometricEnabled = false;
  bool _notificationsEnabled = true;
  bool _cellularDataSaver = false;
  String _streamingQuality = 'Automatique (HD)';

  @override
  void initState() {
    super.initState();
    _loadData();
    _loadSettings();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final user = await _storage.getUser();
    final freshUser = await _apiService.getProfile();
    final plans = await _apiService.getSubscriptionPlans();

    if (mounted) {
      setState(() {
        _currentUser = freshUser ?? user;
        _plans = plans;
        _isLoading = false;
      });
    }
  }

  Future<void> _loadSettings() async {
    final bio = BiometricService().isEnabled;
    if (mounted) {
      setState(() {
        _biometricEnabled = bio;
      });
    }
  }

  Future<void> _openAuth({bool isRegister = false}) async {
    final loggedIn = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => AuthScreen(isInitialRegister: isRegister)),
    );

    if (loggedIn == true) {
      _loadData();
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Déconnexion', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Voulez-vous vraiment vous déconnecter de votre compte ?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE50914),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Déconnexion'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _storage.clearAuth();
      if (mounted) {
        setState(() => _currentUser = null);
      }
    }
  }

  void _showQualityPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF18181C),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(
                  'Qualité vidéo de streaming',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                ),
              ),
              const Divider(color: Colors.white12),
              ...['Automatique (Recommandé)', 'Standard (Économie 720p)', 'Haute Définition (1080p)', 'Ultra HD 4K (VIP)'].map(
                (q) => ListTile(
                  title: Text(
                    q,
                    style: TextStyle(
                      color: _streamingQuality == q ? const Color(0xFFE50914) : Colors.white,
                      fontWeight: _streamingQuality == q ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                  trailing: _streamingQuality == q
                      ? const Icon(Icons.check, color: Color(0xFFE50914), size: 20)
                      : null,
                  onTap: () {
                    setState(() => _streamingQuality = q);
                    Navigator.pop(ctx);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isGuest = _currentUser == null;
    final isVip = _currentUser?.subscription?.status == 'active';

    return Scaffold(
      backgroundColor: const Color(0xFF000000),
      appBar: AppBar(
        backgroundColor: const Color(0xFF000000),
        elevation: 0,
        title: const Text(
          'Profil et Compte',
          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded, color: Colors.white70),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Aucune nouvelle notification.')),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFE50914), strokeWidth: 2))
          : RefreshIndicator(
              color: const Color(0xFFE50914),
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  // ── 1. NETFLIX PROFILE HERO ──
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        // Avatar carré style Netflix
                        Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: isVip ? const Color(0xFFE50914) : const Color(0xFF1F449B),
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.5),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Center(
                            child: isGuest
                                ? const FaIcon(FontAwesomeIcons.user, color: Colors.white70, size: 28)
                                : Text(
                                    (_currentUser?.username?.isNotEmpty == true
                                            ? _currentUser!.username![0]
                                            : _currentUser?.email.isNotEmpty == true
                                                ? _currentUser!.email[0]
                                                : 'U')
                                        .toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 28,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 16),

                        // Nom & Statut du compte
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isGuest ? 'Invité' : (_currentUser?.username ?? _currentUser?.email ?? 'Membre CHILLERS'),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: -0.3,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isVip ? const Color(0xFFE50914) : const Color(0xFF262626),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      isVip ? 'CHILLERS VIP' : 'STANDARD HD',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                  if (!isGuest && !isVip) ...[
                                    const SizedBox(width: 8),
                                    GestureDetector(
                                      onTap: () => UpgradeModal.show(context),
                                      child: const Text(
                                        'Passer VIP',
                                        style: TextStyle(
                                          color: Color(0xFFE50914),
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Bouton Connexion si Invité
                        if (isGuest)
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE50914),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                            onPressed: () => _openAuth(),
                            child: const Text('Connexion', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),
                  const Divider(color: Colors.white10, height: 1),

                  // ── 2. MON ESPACE & CONTENUS ──
                  _buildSectionTitle('Mon Espace'),
                  _buildNetflixTile(
                    icon: Icons.bookmark_border_rounded,
                    title: 'Ma Liste',
                    subtitle: 'Films et séries enregistrés',
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const FavoritesScreen()));
                    },
                  ),
                  _buildNetflixTile(
                    icon: Icons.history_rounded,
                    title: 'Historique de lecture',
                    subtitle: 'Reprendre vos vidéos en cours',
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const HistoryScreen()));
                    },
                  ),
                  _buildNetflixTile(
                    icon: Icons.playlist_play_rounded,
                    title: 'Mes Playlists',
                    subtitle: 'Vos sélections personnalisées',
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const PlaylistsScreen()));
                    },
                  ),

                  const SizedBox(height: 12),
                  const Divider(color: Colors.white10, height: 1),

                  // ── 3. PARAMÈTRES DE L'APPLICATION ──
                  _buildSectionTitle('Paramètres de lecture & App'),
                  _buildNetflixTile(
                    icon: Icons.hd_outlined,
                    title: 'Qualité vidéo de streaming',
                    trailingText: _streamingQuality,
                    onTap: _showQualityPicker,
                  ),
                  _buildNetflixSwitchTile(
                    icon: Icons.data_usage_rounded,
                    title: 'Économiseur de données mobiles',
                    subtitle: 'Réduit la consommation sur réseau cellulaire',
                    value: _cellularDataSaver,
                    onChanged: (val) => setState(() => _cellularDataSaver = val),
                  ),
                  _buildNetflixSwitchTile(
                    icon: Icons.fingerprint_rounded,
                    title: 'Sécurité & Verrouillage biométrique',
                    subtitle: 'Protéger l\'accès avec Face ID / Empreinte',
                    value: _biometricEnabled,
                    onChanged: (val) async {
                      await BiometricService().setBiometricEnabled(val);
                      setState(() => _biometricEnabled = val);
                    },
                  ),
                  _buildNetflixSwitchTile(
                    icon: Icons.notifications_active_outlined,
                    title: 'Notifications & Nouveautés',
                    subtitle: 'Alertes pour les nouveaux épisodes',
                    value: _notificationsEnabled,
                    onChanged: (val) => setState(() => _notificationsEnabled = val),
                  ),

                  const SizedBox(height: 12),
                  const Divider(color: Colors.white10, height: 1),

                  // ── 4. ABONNEMENT & AVANTAGES ──
                  _buildSectionTitle('Abonnement & Avantages'),
                  _buildNetflixTile(
                    icon: Icons.card_membership_rounded,
                    title: isVip ? 'Gérer mon abonnement VIP' : 'Découvrir les forfaits VIP',
                    subtitle: isVip ? 'Actif - 4K Ultra HD & Téléchargements' : 'Téléchargements sans limites & 0 pub',
                    trailingWidget: isVip
                        ? null
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE50914),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('VOIR LES OFFRES', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                    onTap: () => UpgradeModal.show(context),
                  ),

                  const SizedBox(height: 12),
                  const Divider(color: Colors.white10, height: 1),

                  // ── 5. ASSISTANCE & LÉGAL ──
                  _buildSectionTitle('Assistance & Informations'),
                  _buildNetflixTile(
                    icon: Icons.help_outline_rounded,
                    title: 'Centre d\'aide & FAQ',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Support CHILLERS : support@chillers.app')),
                      );
                    },
                  ),
                  _buildNetflixTile(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Confidentialité et Conditions',
                    onTap: () {},
                  ),

                  const SizedBox(height: 24),

                  // ── 6. DÉCONNEXION & VERSION ──
                  if (!isGuest)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: TextButton(
                        onPressed: _logout,
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFE50914),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: const Text(
                          'Se déconnecter',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFE50914),
                          ),
                        ),
                      ),
                    ),

                  const SizedBox(height: 12),
                  const Center(
                    child: Text(
                      'CHILLERS v2.4.0 (Build 2026)',
                      style: TextStyle(color: Colors.white24, fontSize: 11),
                    ),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: Colors.white38,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.1,
        ),
      ),
    );
  }

  Widget _buildNetflixTile({
    required IconData icon,
    required String title,
    String? subtitle,
    String? trailingText,
    Widget? trailingWidget,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: Colors.white70, size: 22),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w500),
      ),
      subtitle: subtitle != null
          ? Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 11.5))
          : null,
      trailing: trailingWidget ??
          (trailingText != null
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(trailingText, style: const TextStyle(color: Colors.white54, fontSize: 12)),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right, color: Colors.white30, size: 18),
                  ],
                )
              : const Icon(Icons.chevron_right, color: Colors.white30, size: 18)),
      onTap: onTap,
    );
  }

  Widget _buildNetflixSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return SwitchListTile(
      secondary: Icon(icon, color: Colors.white70, size: 22),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w500),
      ),
      subtitle: Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 11.5)),
      value: value,
      activeColor: const Color(0xFFE50914),
      onChanged: onChanged,
    );
  }
}
