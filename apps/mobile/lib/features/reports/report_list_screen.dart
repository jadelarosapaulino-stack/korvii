import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/models.dart';
import '../../core/reports_repository.dart';
import '../../shared/korvi_letter_loader.dart';
import '../../shared/motion.dart';

class ReportListScreen extends StatefulWidget {
  const ReportListScreen({
    super.key,
    required this.reports,
    this.onCreateReport,
    this.onOpenMap,
  });

  final ReportsRepository reports;
  final VoidCallback? onCreateReport;
  final VoidCallback? onOpenMap;

  @override
  State<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends State<ReportListScreen> {
  final _query = TextEditingController();
  ReportCategory? _category;
  String _status = 'ALL';
  int? _minRisk;
  int _page = 1;
  ReportPage? _reportPage;
  bool _loading = true;
  String? _error;

  static const _statuses = [
    ('ALL', 'Todos'),
    ('PENDING', 'Pendientes'),
    ('VALIDATED', 'Validados'),
    ('IN_PROGRESS', 'En proceso'),
    ('RESOLVED', 'Resueltos'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final page = _reportPage;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportes'),
        actions: [
          IconButton(
            tooltip: 'Ver mapa',
            onPressed: widget.onOpenMap,
            icon: const Icon(Icons.map_outlined),
          ),
          IconButton(
            tooltip: 'Actualizar',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: widget.onCreateReport,
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Reportar'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            16,
            12,
            16,
            MediaQuery.paddingOf(context).bottom + 136,
          ),
          children: [
            MotionFadeSlide(
              offset: const Offset(0, 14),
              child: _FiltersPanel(
                query: _query,
                status: _status,
                category: _category,
                minRisk: _minRisk,
                statuses: _statuses,
                onStatusChanged: (value) {
                  setState(() {
                    _status = value;
                    _page = 1;
                  });
                  _load();
                },
                onCategoryChanged: (value) {
                  setState(() {
                    _category = value;
                    _page = 1;
                  });
                  _load();
                },
                onMinRiskChanged: (value) {
                  setState(() {
                    _minRisk = value;
                    _page = 1;
                  });
                  _load();
                },
                onSearch: () {
                  setState(() => _page = 1);
                  _load();
                },
                onClear: _clearFilters,
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              const SizedBox(
                height: 280,
                child: Center(child: KorviLetterLoader(label: 'KORVI Drive')),
              )
            else if (_error != null)
              _EmptyState(
                icon: Icons.cloud_off_outlined,
                title: 'No fue posible cargar reportes',
                message: _error!,
                actionLabel: 'Reintentar',
                onAction: _load,
              )
            else if (page == null || page.data.isEmpty)
              _EmptyState(
                icon: Icons.flag_outlined,
                title: 'No hay reportes visibles',
                message: 'Ajusta los filtros o crea un nuevo reporte.',
                actionLabel: 'Crear reporte',
                onAction: widget.onCreateReport,
              )
            else ...[
              MotionFadeSlide(
                delay: const Duration(milliseconds: 80),
                child: _SummaryStrip(page: page),
              ),
              const SizedBox(height: 10),
              ...page.data.asMap().entries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: MotionFadeSlide(
                        key: ValueKey(entry.value.id),
                        delay: Duration(
                          milliseconds: entry.key.clamp(0, 6) * 45,
                        ),
                        offset: const Offset(0, 16),
                        child: _ReportCard(
                          report: entry.value,
                          onTap: () => _openDetails(entry.value),
                        ),
                      ),
                    ),
                  ),
              _PaginationBar(
                page: page,
                onPrevious: page.page > 1
                    ? () {
                        setState(() => _page -= 1);
                        _load();
                      }
                    : null,
                onNext: page.page < page.totalPages
                    ? () {
                        setState(() => _page += 1);
                        _load();
                      }
                    : null,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.reports.list(
        page: _page,
        status: _status,
        category: _category,
        minRisk: _minRisk,
        query: _query.text,
      );
      if (!mounted) return;
      setState(() => _reportPage = page);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Revisa tu conexion o intenta nuevamente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _clearFilters() {
    setState(() {
      _query.clear();
      _category = null;
      _status = 'ALL';
      _minRisk = null;
      _page = 1;
    });
    _load();
  }

  void _openDetails(ReportPoint report) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ReportDetailsSheet(report: report),
    );
  }
}

class _FiltersPanel extends StatelessWidget {
  const _FiltersPanel({
    required this.query,
    required this.status,
    required this.category,
    required this.minRisk,
    required this.statuses,
    required this.onStatusChanged,
    required this.onCategoryChanged,
    required this.onMinRiskChanged,
    required this.onSearch,
    required this.onClear,
  });

  final TextEditingController query;
  final String status;
  final ReportCategory? category;
  final int? minRisk;
  final List<(String, String)> statuses;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<ReportCategory?> onCategoryChanged;
  final ValueChanged<int?> onMinRiskChanged;
  final VoidCallback onSearch;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE1ECEA)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            TextField(
              controller: query,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => onSearch(),
              decoration: InputDecoration(
                labelText: 'Buscar por titulo, descripcion o direccion',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: 'Buscar',
                  onPressed: onSearch,
                  icon: const Icon(Icons.arrow_forward),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: const InputDecoration(labelText: 'Estado'),
                    items: statuses
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.$1,
                            child: Text(item.$2),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => onStatusChanged(value ?? 'ALL'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: DropdownButtonFormField<int?>(
                    initialValue: minRisk,
                    decoration: const InputDecoration(labelText: 'Riesgo'),
                    items: const [
                      DropdownMenuItem(value: null, child: Text('Todos')),
                      DropdownMenuItem(value: 3, child: Text('3+')),
                      DropdownMenuItem(value: 4, child: Text('4+')),
                      DropdownMenuItem(value: 5, child: Text('5')),
                    ],
                    onChanged: onMinRiskChanged,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<ReportCategory?>(
              initialValue: category,
              decoration: const InputDecoration(labelText: 'Categoria'),
              items: [
                const DropdownMenuItem(value: null, child: Text('Todas')),
                ...ReportCategory.values.map(
                  (item) => DropdownMenuItem(
                    value: item,
                    child: Text(item.label),
                  ),
                ),
              ],
              onChanged: onCategoryChanged,
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onClear,
                icon: const Icon(Icons.filter_alt_off_outlined),
                label: const Text('Limpiar filtros'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.page});

  final ReportPage page;

  @override
  Widget build(BuildContext context) {
    final highRisk = page.data.where((report) => report.riskLevel >= 4).length;
    final pending =
        page.data.where((report) => report.status == 'PENDING').length;
    return Row(
      children: [
        Expanded(child: _SummaryPill(value: '${page.total}', label: 'total')),
        const SizedBox(width: 8),
        Expanded(child: _SummaryPill(value: '$highRisk', label: 'criticos')),
        const SizedBox(width: 8),
        Expanded(child: _SummaryPill(value: '$pending', label: 'pendientes')),
      ],
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE5FBF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report, required this.onTap});

  final ReportPoint report;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final riskColor = _riskColor(report.riskLevel);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE1ECEA)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: Color.lerp(riskColor, Colors.white, 0.84),
                  foregroundColor: riskColor,
                  child: Icon(_iconFor(report.category), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${_categoryLabel(report.category)} · ${_statusLabel(report.status)}',
                        style: const TextStyle(
                            color: Color(0xFF6B7785),
                            fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              report.description.isEmpty
                  ? report.address ?? 'Sin descripcion'
                  : report.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _TinyPill(
                  icon: Icons.speed,
                  label: '${report.riskLevel}/5',
                  color: riskColor,
                ),
                const SizedBox(width: 8),
                _TinyPill(
                  icon: Icons.verified_outlined,
                  label: '${report.confirmationCount} conf.',
                  color: const Color(0xFF00A99D),
                ),
                const Spacer(),
                Text(
                  _dateLabel(report.createdAt),
                  style: const TextStyle(
                      color: Color(0xFF6B7785), fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportDetailsSheet extends StatelessWidget {
  const _ReportDetailsSheet({required this.report});

  final ReportPoint report;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.paddingOf(context).bottom + 20,
      ),
      child: ListView(
        shrinkWrap: true,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor:
                    Color.lerp(_riskColor(report.riskLevel), Colors.white, 0.8),
                foregroundColor: _riskColor(report.riskLevel),
                child: Icon(_iconFor(report.category)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  report.title,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(report.description.isEmpty
              ? 'Sin descripcion'
              : report.description),
          const SizedBox(height: 16),
          _DetailRow(
              label: 'Categoria', value: _categoryLabel(report.category)),
          _DetailRow(label: 'Estado', value: _statusLabel(report.status)),
          _DetailRow(label: 'Nivel de riesgo', value: '${report.riskLevel}/5'),
          _DetailRow(
              label: 'Confirmaciones',
              value:
                  '${report.confirmationCount} · ${_confirmersLabel(report)}'),
          _DetailRow(
              label: 'Provincia', value: report.province ?? 'Sin definir'),
          _DetailRow(
              label: 'Municipio', value: report.municipality ?? 'Sin definir'),
          _DetailRow(
              label: 'Direccion', value: report.address ?? 'Sin definir'),
          _DetailRow(
            label: 'Coordenadas',
            value:
                '${report.latitude.toStringAsFixed(5)}, ${report.longitude.toStringAsFixed(5)}',
          ),
          _DetailRow(label: 'Fuente', value: _sourceLabel(report.source)),
          _DetailRow(label: 'Fecha', value: _dateLabel(report.createdAt)),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.check),
            label: const Text('Listo'),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(label,
                style: const TextStyle(
                    color: Color(0xFF6B7785), fontWeight: FontWeight.w800)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({
    required this.page,
    required this.onPrevious,
    required this.onNext,
  });

  final ReportPage page;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          tooltip: 'Anterior',
          onPressed: onPrevious,
          icon: const Icon(Icons.chevron_left),
        ),
        Expanded(
          child: Text(
            'Pagina ${page.page} de ${page.totalPages}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
        ),
        IconButton(
          tooltip: 'Siguiente',
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    );
  }
}

class _TinyPill extends StatelessWidget {
  const _TinyPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: Color.lerp(color, Colors.white, 0.88),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 5),
          Text(label,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE1ECEA)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 42, color: const Color(0xFF00A99D)),
          const SizedBox(height: 10),
          Text(title,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 14),
          OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}

String _categoryLabel(String category) {
  for (final item in ReportCategory.values) {
    if (item.value == category) return item.label;
  }
  return 'Otro riesgo';
}

String _statusLabel(String status) {
  return switch (status) {
    'PENDING' => 'Pendiente',
    'VALIDATED' => 'Validado',
    'IN_PROGRESS' => 'En proceso',
    'RESOLVED' => 'Resuelto',
    'REJECTED' => 'Rechazado',
    'DUPLICATE' => 'Duplicado',
    _ => status,
  };
}

String _sourceLabel(String? source) {
  if (source == 'mobile') return 'App movil';
  if (source == 'system') return 'Sistema';
  return 'Web';
}

String _confirmersLabel(ReportPoint report) {
  final names = report.confirmers
      .map((item) => item.fullName)
      .where((name) => name.trim().isNotEmpty)
      .join(', ');
  return names.isEmpty ? 'Sin confirmar' : names;
}

String _dateLabel(String? value) {
  if (value == null || value.isEmpty) return 'Sin fecha';
  final date = DateTime.tryParse(value);
  if (date == null) return value;
  return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
}

Color _riskColor(int riskLevel) {
  if (riskLevel >= 5) return const Color(0xFFD83B2D);
  if (riskLevel == 4) return const Color(0xFFFF6B35);
  if (riskLevel == 3) return const Color(0xFFFFA37F);
  return const Color(0xFF00A99D);
}

IconData _iconFor(String category) {
  return switch (category) {
    'ACCIDENT' => Icons.car_crash,
    'TRAFFIC_LIGHT_DAMAGED' => Icons.traffic,
    'ROAD_DAMAGE' => Icons.construction,
    'ROAD_OBSTRUCTION' => Icons.warning_amber,
    'POOR_LIGHTING' => Icons.lightbulb,
    'MISSING_SIGNAGE' => Icons.signpost,
    'RECKLESS_DRIVING' => Icons.speed,
    'DANGEROUS_CROSSING' => Icons.directions_walk,
    'FLOOD_ZONE' => Icons.flood,
    'POLICE_ON_ROAD' => Icons.local_police,
    _ => Icons.warning,
  };
}
