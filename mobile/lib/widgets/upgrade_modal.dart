import 'package:flutter/material.dart';
import '../config/theme.dart';

class UpgradeModal extends StatefulWidget {
  const UpgradeModal({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const UpgradeModal(),
    );
  }

  @override
  State<UpgradeModal> createState() => _UpgradeModalState();
}

class _UpgradeModalState extends State<UpgradeModal> {
  int _selectedPlan = 1; // 0 = 24h, 1 = Mensuel, 2 = Annuel
  String _selectedPaymentMethod = 'wave';
  bool _isProcessing = false;

  final List<Map<String, dynamic>> _plans = const [
    {
      'id': 0,
      'name': 'Pass 24 Heures',
      'price': '500 FCFA',
      'period': '24h d\'accès total',
      'tag': null,
    },
    {
      'id': 1,
      'name': 'VIP Mensuel',
      'price': '2 500 FCFA',
      'period': '/ mois',
      'tag': 'POPULAIRE',
    },
    {
      'id': 2,
      'name': 'VIP Annuel',
      'price': '20 000 FCFA',
      'period': '/ an (-35%)',
      'tag': 'MEILLEURE OFFRE',
    },
  ];

  final List<Map<String, dynamic>> _paymentMethods = const [
    {'id': 'wave', 'name': 'Wave Mobile Money', 'icon': Icons.account_balance_wallet_rounded, 'color': Color(0xFF1DC7EA)},
    {'id': 'orange', 'name': 'Orange Money', 'icon': Icons.phone_android_rounded, 'color': Color(0xFFFF7900)},
    {'id': 'mtn', 'name': 'MTN MoMo', 'icon': Icons.flash_on_rounded, 'color': Color(0xFFFFCC00)},
    {'id': 'card', 'name': 'Carte Visa / Mastercard', 'icon': Icons.credit_card_rounded, 'color': Color(0xFF6C5CE7)},
    {'id': 'crypto', 'name': 'Crypto (USDT / BTC)', 'icon': Icons.currency_bitcoin_rounded, 'color': Color(0xFFF7931A)},
  ];

  void _handleSubscribe() async {
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;
    setState(() => _isProcessing = false);

    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: Colors.green,
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Abonnement ${_plans[_selectedPlan]['name']} activé avec succès !',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
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

            // Header badge & title
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Colors.amber, Colors.orangeAccent],
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.workspace_premium_rounded, color: Colors.black, size: 16),
                      SizedBox(width: 4),
                      Text(
                        'CHILLERS VIP',
                        style: TextStyle(color: Colors.black, fontWeight: FontWeight.w900, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
                ),
              ],
            ),
            const SizedBox(height: 10),

            const Text(
              'Débloquez l\'expérience Ultime',
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            const Text(
              'Serveurs 4K Ultra Rapides, aucun temps de chargement, zéro publicité et téléchargements illimités.',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),

            // VIP Perks List
            _buildPerkItem(Icons.speed_rounded, 'Serveurs Dédiés Ultra-Haut Débit 4K & 1080p'),
            _buildPerkItem(Icons.block_rounded, 'Zéro Publicité & Visionnage Ininterrompu'),
            _buildPerkItem(Icons.download_done_rounded, 'Téléchargements Illimités pour visionnage hors-ligne'),
            _buildPerkItem(Icons.sports_soccer_rounded, 'Accès prioritaire à tous les matchs de foot en direct'),
            const SizedBox(height: 20),

            // Choisir un forfait
            const Text(
              'Choisissez votre formule',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            Row(
              children: _plans.map((plan) {
                final isSelected = _selectedPlan == plan['id'];
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedPlan = plan['id'] as int),
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? AppTheme.primary : Colors.white12,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Column(
                        children: [
                          if (plan['tag'] != null)
                            Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                plan['tag'] as String,
                                style: const TextStyle(color: Colors.black, fontSize: 8, fontWeight: FontWeight.bold),
                              ),
                            ),
                          Text(
                            plan['name'] as String,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isSelected ? Colors.white : Colors.white70,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            plan['price'] as String,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: AppTheme.primary,
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          Text(
                            plan['period'] as String,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Mode de paiement
            const Text(
              'Mode de paiement',
              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),

            Column(
              children: _paymentMethods.map((pm) {
                final isSelected = _selectedPaymentMethod == pm['id'];
                return GestureDetector(
                  onTap: () => setState(() => _selectedPaymentMethod = pm['id'] as String),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.white.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.03),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected ? AppTheme.primary : Colors.white10,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(pm['icon'] as IconData, color: pm['color'] as Color, size: 22),
                        const SizedBox(width: 12),
                        Text(
                          pm['name'] as String,
                          style: TextStyle(
                            color: isSelected ? Colors.white : Colors.white70,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                        ),
                        const Spacer(),
                        if (isSelected)
                          const Icon(Icons.check_circle_rounded, color: AppTheme.primary, size: 20)
                        else
                          const Icon(Icons.radio_button_unchecked_rounded, color: Colors.white24, size: 20),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Bouton de validation
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 4,
                ),
                onPressed: _isProcessing ? null : _handleSubscribe,
                child: _isProcessing
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_outline_rounded, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Activer VIP (${_plans[_selectedPlan]['price']})',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPerkItem(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, color: Colors.greenAccent, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
