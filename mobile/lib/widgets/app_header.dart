import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/user_model.dart';
import '../screens/search/search_screen.dart';
import '../screens/profile/profile_screen.dart';
import 'upgrade_modal.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final GlobalKey<ScaffoldState> scaffoldKey;
  final UserModel? user;
  final VoidCallback? onLogoTap;

  const AppHeader({
    super.key,
    required this.scaffoldKey,
    this.user,
    this.onLogoTap,
  });

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final isVip = user?.subscription?.status == 'active';
    final topPadding = MediaQuery.of(context).padding.top;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.88),
            Colors.black.withValues(alpha: 0.55),
            Colors.black.withValues(alpha: 0.15),
            Colors.transparent,
          ],
          stops: const [0.0, 0.45, 0.8, 1.0],
        ),
      ),
      padding: EdgeInsets.fromLTRB(16, topPadding + 4, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // GAUCHE : Burger Menu + Logo CHILLERS
          Row(
            children: [
              GestureDetector(
                onTap: () => scaffoldKey.currentState?.openDrawer(),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white12),
                  ),
                  child: const Icon(Icons.menu_rounded, color: Colors.white, size: 22),
                ),
              ),
              const SizedBox(width: 12),
              GestureDetector(
                onTap: onLogoTap,
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.asset(
                        'assets/logo.png',
                        width: 30,
                        height: 30,
                        errorBuilder: (context, error, stackTrace) => Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    RichText(
                      text: const TextSpan(
                        children: [
                          TextSpan(
                            text: 'CHILL',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.0,
                            ),
                          ),
                          TextSpan(
                            text: 'ERS',
                            style: TextStyle(
                              color: AppTheme.primary,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // DROITE : Recherche + VIP Crown + Profil
          Row(
            children: [
              // Bouton Recherche Rapide
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SearchScreen()),
                  );
                },
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.4),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white12),
                  ),
                  child: const Icon(
                    Icons.search_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Bouton VIP Gold Crown
              GestureDetector(
                onTap: () => UpgradeModal.show(context),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.amber,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.amber.withValues(alpha: 0.45),
                        blurRadius: 10,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.workspace_premium_rounded,
                    color: Colors.black,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Profil Avatar
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ProfileScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isVip ? Colors.amber : Colors.white30,
                      width: isVip ? 2 : 1.5,
                    ),
                  ),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTheme.card,
                    child: Text(
                      (user?.username?.isNotEmpty == true
                              ? user!.username![0]
                              : (user?.email.isNotEmpty == true ? user!.email[0] : 'U'))
                          .toUpperCase(),
                      style: TextStyle(
                        color: isVip ? Colors.amber : Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
