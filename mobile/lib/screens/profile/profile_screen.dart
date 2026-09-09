import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../models/user_model.dart';
import '../../models/subscription_plan.dart';
import '../../services/storage_service.dart';
import '../../services/api_service.dart';
import '../auth/auth_screen.dart';

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
          'Êtes-vous sûr de vouloir vous déconnecter ? Vous repasserez en mode visiteur.',
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
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _storage.clearAuth();
      if (mounted) {
        setState(() => _currentUser = null);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Déconnecté avec succès. Mode visiteur actif.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isGuest = _currentUser == null;
    final isVip = _currentUser?.subscription?.status == 'active';

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0C0E),
        elevation: 0,
        title: const Text(
          'Mon Compte',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 18),
        ),
        actions: [
          if (!isGuest)
            IconButton(
              icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
              tooltip: 'Se déconnecter',
              onPressed: _logout,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
              color: AppTheme.primary,
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    // EN-TÊTE PROFIL / MODE VISITEUR
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isVip
                              ? Colors.amber.withValues(alpha: 0.4)
                              : Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Column(
                        children: [
                          Stack(
                            alignment: Alignment.bottomRight,
                            children: [
                              CircleAvatar(
                                radius: 40,
                                backgroundColor: isVip
                                    ? Colors.amber.withValues(alpha: 0.2)
                                    : AppTheme.primary.withValues(alpha: 0.15),
                                child: Text(
                                  isGuest
                                      ? '?'
                                      : (_currentUser!.username?.isNotEmpty == true
                                              ? _currentUser!.username![0]
                                              : _currentUser!.email[0])
                                          .toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 32,
                                    fontWeight: FontWeight.bold,
                                    color: isVip ? Colors.amber : (isGuest ? Colors.white70 : AppTheme.primary),
                                  ),
                                ),
                              ),
                              if (isVip)
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: Colors.amber,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.workspace_premium_rounded, color: Colors.black, size: 16),
                                ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Text(
                            isGuest ? 'Mode Visiteur' : (_currentUser!.username ?? _currentUser!.email.split('@')[0]),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            isGuest
                                ? 'Non connecté (accès aux fonctionnalités de base)'
                                : _currentUser!.email,
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            textAlign: TextAlign.center,
                          ),

                          // Badges Statut
                          const SizedBox(height: 12),
                          if (isGuest)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'INVITÉ',
                                style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            )
                          else if (isVip)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.amber,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'MEMBRE VIP',
                                style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w900),
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.blueGrey.withValues(alpha: 0.3),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'COMPTE STANDARD',
                                style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // CARTE APPEL À L'ACTION : Si mode invité
                    if (isGuest) ...[
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppTheme.primary.withValues(alpha: 0.2),
                              Colors.transparent,
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.stars_rounded, color: AppTheme.primary, size: 24),
                                SizedBox(width: 8),
                                Text(
                                  'Passez à la vitesse supérieure',
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Créez un compte gratuit pour synchroniser vos favoris, reprendre la lecture sur tous vos écrans et profiter des offres CHILLERS VIP.',
                              style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    onPressed: () => _openAuth(isRegister: false),
                                    child: const Text('Connexion', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: OutlinedButton(
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: const BorderSide(color: Colors.white30),
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    onPressed: () => _openAuth(isRegister: true),
                                    child: const Text('S\'inscrire', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // CARTE ABONNEMENT VIP
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.workspace_premium_rounded, color: Colors.amber, size: 22),
                                  SizedBox(width: 8),
                                  Text(
                                    'CHILLERS VIP',
                                    style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                ],
                              ),
                              Text('Streaming 4K / HD', style: TextStyle(color: Colors.amberAccent, fontSize: 11)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            '• Zéro publicité et temps d\'attente supprimé\n• Téléchargements haute vitesse illimités\n• Accès prioritaire à toutes les nouveautés & IPTV en direct',
                            style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.5),
                          ),
                          if (_plans.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            SizedBox(
                              height: 90,
                              child: ListView.builder(
                                scrollDirection: Axis.horizontal,
                                itemCount: _plans.length,
                                itemBuilder: (context, index) {
                                  final plan = _plans[index];
                                  return Container(
                                    width: 140,
                                    margin: const EdgeInsets.only(right: 10),
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AppTheme.card,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          plan.name,
                                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                                          maxLines: 1,
                                        ),
                                        Text(
                                          '${plan.price} ${plan.currency}',
                                          style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.w900, fontSize: 14),
                                        ),
                                        Text(
                                          '${plan.durationDays} jours',
                                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // LISTE DES OPTIONS / PARAMÈTRES
                    _buildOptionTile(
                      icon: Icons.bookmark_outline_rounded,
                      title: 'Ma Liste de Lecture',
                      subtitle: isGuest ? 'Connectez-vous pour sauvegarder' : 'Vos films et séries enregistrés',
                      onTap: () {
                        if (isGuest) {
                          _openAuth();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Accès à votre liste')),
                          );
                        }
                      },
                    ),
                    _buildOptionTile(
                      icon: Icons.favorite_border_rounded,
                      title: 'Mes Favoris',
                      subtitle: isGuest ? 'Connectez-vous pour sauvegarder' : 'Vos coups de cœur',
                      onTap: () {
                        if (isGuest) {
                          _openAuth();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Accès à vos favoris')),
                          );
                        }
                      },
                    ),
                    _buildOptionTile(
                      icon: Icons.download_done_rounded,
                      title: 'Téléchargements',
                      subtitle: 'Gérer vos fichiers hors ligne',
                      onTap: () {},
                    ),
                    _buildOptionTile(
                      icon: Icons.notifications_none_rounded,
                      title: 'Notifications & Alertes',
                      subtitle: 'Nouveautés et sorties',
                      onTap: () {},
                    ),
                    _buildOptionTile(
                      icon: Icons.info_outline_rounded,
                      title: 'À propos de CHILLERS',
                      subtitle: 'Version 1.0.0 (Mobile)',
                      onTap: () {
                        showAboutDialog(
                          context: context,
                          applicationName: 'CHILLERS',
                          applicationVersion: '1.0.0',
                          applicationLegalese: '© 2025-2026 CHILLERS Streaming',
                        );
                      },
                    ),

                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Material(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          leading: Icon(icon, color: AppTheme.primary, size: 22),
          title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
          subtitle: subtitle != null
              ? Text(subtitle, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11))
              : null,
          trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 14),
          onTap: onTap,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}
