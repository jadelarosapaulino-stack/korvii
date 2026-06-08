import 'package:flutter/material.dart';

import '../../core/activity_repository.dart';
import '../../core/auth_repository.dart';
import '../../core/education_repository.dart';
import '../../core/location_service.dart';
import '../../core/notification_service.dart';
import '../../core/reports_repository.dart';
import '../education/education_screen.dart';
import '../emergency/emergency_screen.dart';
import 'profile_screen.dart';
import '../reports/report_create_screen.dart';
import '../reports/report_list_screen.dart';
import '../reports/risk_map_screen.dart';

class CitizenShell extends StatefulWidget {
  const CitizenShell({
    super.key,
    required this.activity,
    required this.auth,
    required this.reports,
    required this.education,
    required this.location,
    required this.notifications,
    required this.onLogout,
  });

  final ActivityRepository activity;
  final AuthRepository auth;
  final ReportsRepository reports;
  final EducationRepository education;
  final LocationService location;
  final NotificationService notifications;
  final VoidCallback onLogout;

  @override
  State<CitizenShell> createState() => _CitizenShellState();
}

class _CitizenShellState extends State<CitizenShell> {
  int _index = 0;
  static const _screenNames = [
    'map',
    'reports',
    'report_create',
    'education',
    'emergency',
    'profile',
  ];

  @override
  void initState() {
    super.initState();
    _trackScreen(0);
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      RiskMapScreen(
          reports: widget.reports,
          location: widget.location,
          notifications: widget.notifications,
          onCreateReport: () => _selectTab(2)),
      ReportListScreen(
        reports: widget.reports,
        onCreateReport: () => _selectTab(2),
        onOpenMap: () => _selectTab(0),
      ),
      ReportCreateScreen(reports: widget.reports, location: widget.location),
      EducationScreen(education: widget.education),
      EmergencyScreen(reports: widget.reports, location: widget.location),
      ProfileScreen(auth: widget.auth, onLogout: widget.onLogout),
    ];

    return Scaffold(
      extendBody: true,
      body: screens[_index],
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(18, 0, 18, 14),
        child: _FloatingNavigationBar(
          selectedIndex: _index,
          onSelected: _selectTab,
        ),
      ),
    );
  }

  void _selectTab(int value) {
    if (_index == value) return;
    setState(() => _index = value);
    _trackScreen(value);
  }

  void _trackScreen(int index) {
    widget.activity
        .track(
          eventType: 'navigation',
          action: 'screen_view',
          screen: _screenNames[index],
          element: 'bottom_navigation',
        )
        .catchError((_) {});
  }
}

class _FloatingNavigationBar extends StatelessWidget {
  const _FloatingNavigationBar({
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const _items = [
    (icon: Icons.map_outlined, selected: Icons.map, label: 'Mapa'),
    (
      icon: Icons.list_alt_outlined,
      selected: Icons.list_alt,
      label: 'Reportes'
    ),
    (
      icon: Icons.add_location_alt_outlined,
      selected: Icons.add_location_alt,
      label: 'Reportar'
    ),
    (icon: Icons.school_outlined, selected: Icons.school, label: 'Educacion'),
    (
      icon: Icons.emergency_outlined,
      selected: Icons.emergency,
      label: 'Emergencia'
    ),
    (icon: Icons.person_outline, selected: Icons.person, label: 'Perfil'),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF050505),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var index = 0; index < _items.length; index++)
              _FloatingNavigationItem(
                icon: selectedIndex == index
                    ? _items[index].selected
                    : _items[index].icon,
                label: _items[index].label,
                selected: selectedIndex == index,
                onTap: () => onSelected(index),
              ),
          ],
        ),
      ),
    );
  }
}

class _FloatingNavigationItem extends StatelessWidget {
  const _FloatingNavigationItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: selected ? 54 : 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? Colors.white : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: selected ? const Color(0xFF050505) : Colors.white,
              size: selected ? 25 : 23,
            ),
          ),
        ),
      ),
    );
  }
}
