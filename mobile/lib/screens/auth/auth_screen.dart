import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../config/theme.dart';
import '../../services/api_service.dart';
import '../../widgets/auth_poster_wall.dart';

class AuthScreen extends StatefulWidget {
  final bool isInitialRegister;

  const AuthScreen({super.key, this.isInitialRegister = false});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final ApiService _apiService = ApiService();

  late bool _isRegister;
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();

  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _isRegister = widget.isInitialRegister;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final username = _usernameController.text.trim();

    Map<String, dynamic> result;

    if (_isRegister) {
      result = await _apiService.register(
        email,
        password,
        username: username.isNotEmpty ? username : null,
        deviceName: 'Mobile App',
      );
    } else {
      result = await _apiService.login(
        email,
        password,
        deviceName: 'Mobile App',
      );
    }

    if (!mounted) return;

    if (result['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isRegister ? 'Compte créé avec succès !' : 'Connexion réussie !'),
          backgroundColor: AppTheme.primary,
        ),
      );
      Navigator.pop(context, true);
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = result['message'] ?? 'Une erreur est survenue lors de l\'authentification.';
      });
    }
  }

  void _continueAsGuest() {
    Navigator.pop(context, false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF060608),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFF18181B).withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: const FaIcon(FontAwesomeIcons.xmark, color: Colors.white, size: 16),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF18181B).withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: TextButton(
              onPressed: _continueAsGuest,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Mode Invité',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background: 4 Columns Animated Poster Wall ──
          const AuthPosterWall(),

          // ── Foreground: Seamless Full-Page Auth Form (No Card Box) ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Logo CHILLERS
                        Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.asset(
                                  'assets/logo.png',
                                  width: 36,
                                  height: 36,
                                  errorBuilder: (context, error, stackTrace) => Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: AppTheme.primary,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const FaIcon(FontAwesomeIcons.play, color: Colors.white, size: 20),
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
                                        fontSize: 26,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                                    TextSpan(
                                      text: 'ERS',
                                      style: TextStyle(
                                        color: AppTheme.primary,
                                        fontSize: 26,
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

                        const SizedBox(height: 20),

                        // Titre et sous-titre
                        Text(
                          _isRegister ? 'Créer un compte' : 'Connexion',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isRegister
                              ? 'Rejoignez CHILLERS pour synchroniser vos favoris et profiter du streaming HD.'
                              : 'Connectez-vous pour retrouver votre liste, vos téléchargements et votre abonnement.',
                          style: const TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 12.5,
                            height: 1.35,
                          ),
                          textAlign: TextAlign.center,
                        ),

                        const SizedBox(height: 20),

                        // Bannière d'erreur
                        if (_errorMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              children: [
                                const FaIcon(FontAwesomeIcons.triangleExclamation, color: Colors.redAccent, size: 18),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Champ Pseudo (si Inscription)
                        if (_isRegister) ...[
                          TextFormField(
                            controller: _usernameController,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'Nom d\'utilisateur (optionnel)',
                              labelStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                              prefixIcon: const FaIcon(FontAwesomeIcons.user, color: Colors.white54, size: 18),
                              filled: true,
                              fillColor: Colors.black.withValues(alpha: 0.4),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],

                        // Champ Email
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Veuillez renseigner votre email';
                            if (!val.contains('@') || !val.contains('.')) return 'Adresse email invalide';
                            return null;
                          },
                          decoration: InputDecoration(
                            labelText: 'Adresse Email',
                            labelStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                            prefixIcon: const FaIcon(FontAwesomeIcons.envelope, color: Colors.white54, size: 18),
                            filled: true,
                            fillColor: Colors.black.withValues(alpha: 0.4),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                            ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Champ Mot de passe
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: Colors.white, fontSize: 14),
                          validator: (val) {
                            if (val == null || val.isEmpty) return 'Veuillez saisir votre mot de passe';
                            if (_isRegister && val.length < 6) return 'Le mot de passe doit comporter au moins 6 caractères';
                            return null;
                          },
                          decoration: InputDecoration(
                            labelText: 'Mot de passe',
                            labelStyle: const TextStyle(color: Colors.white54, fontSize: 13),
                            prefixIcon: const FaIcon(FontAwesomeIcons.lock, color: Colors.white54, size: 18),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? FontAwesomeIcons.eyeSlash.data : FontAwesomeIcons.eye.data,
                                color: Colors.white54,
                                size: 18,
                              ),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                            filled: true,
                            fillColor: Colors.black.withValues(alpha: 0.4),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                            ),
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Bouton Principal Soumettre
                        SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              elevation: 4,
                              shadowColor: AppTheme.primary.withValues(alpha: 0.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            onPressed: _isLoading ? null : _handleSubmit,
                            child: _isLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                  )
                                : Text(
                                    _isRegister ? 'CRÉER MON COMPTE' : 'SE CONNECTER',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5),
                                  ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Bouton Continuer en mode Invité
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white70,
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.15)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          onPressed: _continueAsGuest,
                          icon: const FaIcon(FontAwesomeIcons.magnifyingGlass, size: 16),
                          label: const Text('Continuer en Mode Visiteur', style: TextStyle(fontSize: 13)),
                        ),

                        const SizedBox(height: 18),

                        // Lien Bascule Connexion / Inscription
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _isRegister ? 'Vous avez déjà un compte ?' : 'Pas encore de compte ?',
                              style: const TextStyle(color: Colors.white60, fontSize: 13),
                            ),
                            TextButton(
                              onPressed: () {
                                setState(() {
                                  _isRegister = !_isRegister;
                                  _errorMessage = null;
                                });
                              },
                              child: Text(
                                _isRegister ? 'Se connecter' : 'S\'inscrire',
                                style: const TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
