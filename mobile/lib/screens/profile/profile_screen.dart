import 'package:flutter/material.dart';
import '../../config/theme.dart';
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

  @override
  void initState() {
    super.initState();
    _loadData();
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
        backgroundColor: AppTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Déconnexion', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Êtes-vous sûr de vouloir vous déconnecter ?',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
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

  @override
  Widget build(BuildContext context) {
    final isGuest = _currentUser == null;
    final isVip = _currentUser?.subscription?.status == 'active';

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              color: AppTheme.primary,
              onRefresh: _loadData,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  // YouTube-style Profile Header
                  SliverAppBar(
                    expandedHeight: 260,
                    floating: false,
                    pinned: true,
                    backgroundColor: AppTheme.background,
                    elevation: 0,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              isVip
                                  ? Colors.amber.withValues(alpha: 0.15)
                                  : AppTheme.primary.withValues(alpha: 0.08),
                              AppTheme.background,
                            ],
                          ),
                        ),
                        child: SafeArea(
                          child: SingleChildScrollView(
                            physics: const NeverScrollableScrollPhysics(),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(height: 20),
                                // Avatar
                                CircleAvatar(
                                  radius: 45,
                                  backgroundColor: isVip
                                      ? Colors.amber.withValues(alpha: 0.3)
                                      : AppTheme.primary.withValues(alpha: 0.2),
                                  child: Text(
                                    isGuest
                                        ? '?'
                                        : (_currentUser!.username?.isNotEmpty == true
                                                ? _currentUser!.username![0]
                                                : _currentUser!.email[0])
                                            .toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 40,
                                      fontWeight: FontWeight.bold,
                                      color: isVip ? Colors.amber : (isGuest ? Colors.white70 : AppTheme.primary),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                // Username
                                Text(
                                  isGuest ? 'Mode Visiteur' : (_currentUser!.username ?? _currentUser!.email.split('@')[0]),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                if (!isGuest) ...[
                                  const SizedBox(height: 2),
                                  // Email
                                  Text(
                                    _currentUser!.email,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textSecondary,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ],
                                const SizedBox(height: 10),
                                // Status Badge
                                if (isVip)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.amber,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: const [
                                        Icon(Icons.workspace_premium_rounded, color: Colors.black, size: 12),
                                        SizedBox(width: 4),
                                        Text(
                                          'MEMBRE VIP',
                                          style: TextStyle(
                                            color: Colors.black,
                                            fontSize: 10,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    actions: [
                      if (!isGuest)
                        IconButton(
                          icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                          tooltip: 'Déconnexion',
                          onPressed: _logout,
                        )
                      else
                        const SizedBox(width: 16),
                    ],
                  ),

                  // Content
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Auth Buttons (Guest Mode)
                          if (isGuest) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    icon: const Icon(Icons.login_rounded),
                                    label: const Text('Connexion'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    onPressed: () => _openAuth(isRegister: false),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    icon: const Icon(Icons.person_add_rounded),
                                    label: const Text('S\'inscrire'),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: const BorderSide(color: Colors.white30),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    onPressed: () => _openAuth(isRegister: true),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                          ],

                          // Main Menu Items
                          _buildMenuSection(
                            items: [
                              _MenuItem(
                                icon: Icons.history_rounded,
                                title: 'Lectures Récentes',
                                subtitle: 'Votre historique de visionnage',
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const HistoryScreen()),
                                ),
                              ),
                              _MenuItem(
                                icon: Icons.favorite_rounded,
                                title: 'Favoris & À regarder plus tard',
                                subtitle: 'Vos titres enregistrés',
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                                ),
                              ),
                              _MenuItem(
                                icon: Icons.playlist_play_rounded,
                                title: 'Mes Playlists',
                                subtitle: 'Collections personnalisées',
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const PlaylistsScreen()),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // Premium Section
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: Colors.amber.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 24),
                                    SizedBox(width: 10),
                                    Text(
                                      'CHILLERS VIP',
                                      style: TextStyle(
                                        color: Colors.amber,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                const Text(
                                  '• Streaming HD/4K illimité\n• Sans publicités\n• Téléchargements rapides\n• Accès exclusif aux nouveautés',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 13,
                                    height: 1.6,
                                  ),
                                ),
                                const SizedBox(height: 14),
                                if (_plans.isNotEmpty)
                                  SizedBox(
                                    height: 100,
                                    child: ListView.builder(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: _plans.length,
                                      itemBuilder: (context, index) {
                                        final plan = _plans[index];
                                        return Container(
                                          width: 130,
                                          margin: const EdgeInsets.only(right: 8),
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: AppTheme.card,
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(
                                              color: Colors.amber.withValues(alpha: 0.4),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                plan.name,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              Text(
                                                '${plan.price} ${plan.currency}',
                                                style: const TextStyle(
                                                  color: Colors.amber,
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 15,
                                                ),
                                              ),
                                              Text(
                                                '${plan.durationDays}j',
                                                style: const TextStyle(
                                                  color: AppTheme.textSecondary,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.amber,
                                      foregroundColor: Colors.black,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    onPressed: () => UpgradeModal.show(context),
                                    child: const Text(
                                      'Découvrir les offres',
                                      style: TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Settings Section
                          _buildMenuSection(
                            title: 'PARAMÈTRES',
                            items: [
                              if (BiometricService().isAvailable)
                                _MenuItem(
                                  icon: Icons.fingerprint_rounded,
                                  title: 'Sécurité Biométrique',
                                  subtitle: 'Verrou ${BiometricService().biometricName}',
                                  onTap: () async {
                                    final newValue = !BiometricService().isEnabled;
                                    final success = await BiometricService().setBiometricEnabled(newValue);
                                    if (mounted && !success && newValue) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('Validation biométrique échouée'),
                                        ),
                                      );
                                    } else if (mounted) {
                                      setState(() {});
                                    }
                                  },
                                ),
                              _MenuItem(
                                icon: Icons.notifications_rounded,
                                title: 'Notifications',
                                subtitle: 'Gérer les alertes',
                                onTap: _showNotificationSettingsModal,
                              ),
                              _MenuItem(
                                icon: Icons.info_rounded,
                                title: 'À propos',
                                subtitle: 'Version 1.0.0',
                                onTap: () {
                                  showAboutDialog(
                                    context: context,
                                    applicationName: 'CHILLERS',
                                    applicationVersion: '1.0.0',
                                    applicationLegalese: '© 2025 CHILLERS Streaming',
                                  );
                                },
                              ),
                            ],
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildMenuSection({
    String? title,
    required List<_MenuItem> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 12),
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white54,
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
        ...items.asMap().entries.map((e) {
          final isLast = e.key == items.length - 1;
          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(12),
              ),
              child: ListTile(
                leading: Icon(e.value.icon, color: AppTheme.primary, size: 24),
                title: Text(
                  e.value.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                subtitle: Text(
                  e.value.subtitle,
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
                trailing: const Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: Colors.white30,
                  size: 14,
                ),
                onTap: e.value.onTap,
              ),
            ),
          );
        }),
      ],
    );
  }

  void _showNotificationSettingsModal() {
    final notif = NotificationService();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Icon(Icons.notifications_active_rounded, color: AppTheme.primary, size: 24),
                    SizedBox(width: 10),
                    Text(
                      'Notifications',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  secondary: const Icon(Icons.movie_rounded, color: AppTheme.primary, size: 22),
                  title: const Text(
                    'Nouveaux contenus',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                  ),
                  activeThumbColor: AppTheme.primary,
                  activeTrackColor: AppTheme.primary.withValues(alpha: 0.5),
                  value: notif.releaseAlertsEnabled,
                  onChanged: (val) async {
                    await notif.setReleaseAlertsEnabled(val);
                    setModalState(() {});
                  },
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MenuItem {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  _MenuItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
}
