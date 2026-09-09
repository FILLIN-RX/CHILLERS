import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/user_model.dart';
import '../services/storage_service.dart';
import '../services/api_service.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/auth/auth_screen.dart';

class AppDrawer extends StatefulWidget {
  final String activeCategory;
  final Function(String) onSelectCategory;
  final Function(int)? onNavigateTab;

  const AppDrawer({
    super.key,
    required this.activeCategory,
    required this.onSelectCategory,
    this.onNavigateTab,
  });

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  final StorageService _storage = StorageService();
  final ApiService _apiService = ApiService();
  UserModel? _user;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final cached = await _storage.getUser();
    if (mounted) setState(() => _user = cached);
    final fresh = await _apiService.getProfile();
    if (mounted && fresh != null) {
      setState(() => _user = fresh);
    }
  }

  void _openSubscription() {
    Navigator.pop(context);
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ProfileScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isVip = _user?.subscription?.status == 'active';

    return Drawer(
      backgroundColor: const Color(0xFF121214),
      surfaceTintColor: Colors.transparent,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Drawer : Logo + Bouton Fermer
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.asset(
                          'assets/logo.png',
                          width: 32,
                          height: 32,
                          errorBuilder: (context, error, stackTrace) => Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      RichText(
                        text: const TextSpan(
                          children: [
                            TextSpan(
                              text: 'CHILL',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.0,
                              ),
                            ),
                            TextSpan(
                              text: 'ERS',
                              style: TextStyle(
                                color: AppTheme.primary,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white70),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Divider(color: Colors.white10),
              const SizedBox(height: 8),

              // Navigation Links
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _buildNavItem(
                      icon: Icons.home_rounded,
                      title: 'Accueil',
                      isSelected: widget.activeCategory == 'Tous',
                      onTap: () {
                        widget.onSelectCategory('Tous');
                        Navigator.pop(context);
                      },
                    ),
                    _buildNavItem(
                      icon: Icons.movie_rounded,
                      title: 'Films',
                      isSelected: widget.activeCategory == 'Films',
                      onTap: () {
                        widget.onSelectCategory('Films');
                        Navigator.pop(context);
                      },
                    ),
                    _buildNavItem(
                      icon: Icons.tv_rounded,
                      title: 'Séries',
                      isSelected: widget.activeCategory == 'Séries',
                      onTap: () {
                        widget.onSelectCategory('Séries');
                        Navigator.pop(context);
                      },
                    ),
                    _buildNavItem(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Animes',
                      isSelected: widget.activeCategory == 'Animes',
                      onTap: () {
                        widget.onSelectCategory('Animes');
                        Navigator.pop(context);
                      },
                    ),
                    _buildNavItem(
                      icon: Icons.public_rounded,
                      title: 'Africains',
                      isSelected: widget.activeCategory == 'Africains',
                      onTap: () {
                        widget.onSelectCategory('Africains');
                        Navigator.pop(context);
                      },
                    ),
                    _buildNavItem(
                      icon: Icons.live_tv_rounded,
                      title: 'En Direct',
                      isSelected: widget.activeCategory == 'En Direct',
                      onTap: () {
                        widget.onSelectCategory('En Direct');
                        Navigator.pop(context);
                      },
                    ),

                    const SizedBox(height: 12),
                    const Divider(color: Colors.white10),
                    const SizedBox(height: 12),

                    // Carte Promotion VIP style MovieBox
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withValues(alpha: 0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 18),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'CHILLERS VIP',
                                style: TextStyle(
                                  color: Colors.amber,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Sans pub, streaming HD ultra-rapide & téléchargements illimités',
                            style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.3),
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.amber,
                                foregroundColor: Colors.black,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                              onPressed: _openSubscription,
                              child: Text(
                                isVip ? 'Gérer mon VIP' : 'Débloquer VIP',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Bottom Drawer : User Profil / Déconnexion
              const Divider(color: Colors.white10),
              const SizedBox(height: 8),
              if (_user != null)
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppTheme.card,
                      child: Text(
                        (_user!.username?.isNotEmpty == true
                                ? _user!.username![0]
                                : _user!.email[0])
                            .toUpperCase(),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _user!.username ?? _user!.email.split('@')[0],
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            _user!.email,
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                      tooltip: 'Déconnexion',
                      onPressed: () async {
                        final navigator = Navigator.of(context);
                        await _storage.clearAuth();
                        if (mounted) {
                          setState(() => _user = null);
                          navigator.pop();
                        }
                      },
                    ),
                  ],
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Colors.white24),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                    onPressed: () async {
                      Navigator.pop(context);
                      final loggedIn = await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(builder: (_) => const AuthScreen()),
                      );
                      if (loggedIn == true) {
                        _loadUser();
                      }
                    },
                    icon: const Icon(Icons.login_rounded, size: 18),
                    label: const Text('Connexion / Inscription', style: TextStyle(fontSize: 12)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: isSelected ? Border.all(color: AppTheme.primary.withValues(alpha: 0.3)) : null,
      ),
      child: Material(
        color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          dense: true,
          leading: Icon(
            icon,
            color: isSelected ? AppTheme.primary : Colors.white70,
            size: 20,
          ),
          title: Text(
            title,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.white70,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              fontSize: 14,
            ),
          ),
          trailing: isSelected
              ? Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: AppTheme.primary,
                    shape: BoxShape.circle,
                  ),
                )
              : null,
          onTap: onTap,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}
