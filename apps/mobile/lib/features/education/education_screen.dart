import 'package:flutter/material.dart';

import '../../core/education_repository.dart';
import '../../core/models.dart';
import '../../shared/korvi_letter_loader.dart';

class EducationScreen extends StatefulWidget {
  const EducationScreen({super.key, required this.education});

  final EducationRepository education;

  @override
  State<EducationScreen> createState() => _EducationScreenState();
}

class _EducationScreenState extends State<EducationScreen> {
  late Future<List<Lesson>> _lessons;
  Map<String, LessonProgress> _progressByLesson = {};

  @override
  void initState() {
    super.initState();
    _lessons = widget.education.lessons();
    _loadProgress();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Educación vial')),
      body: FutureBuilder<List<Lesson>>(
        future: _lessons,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(
              child: KorviLetterLoader(label: 'KORVI Drive'),
            );
          }

          final lessons = snapshot.data!;
          if (lessons.isEmpty) {
            return const Center(child: Text('No hay lecciones disponibles.'));
          }

          return RefreshIndicator(
            onRefresh: () async {
              setState(() => _lessons = widget.education.lessons());
              await _loadProgress();
            },
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(
                16,
                16,
                16,
                MediaQuery.paddingOf(context).bottom + 120,
              ),
              itemCount: lessons.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final lesson = lessons[index];
                final progress = _progressByLesson[lesson.id];
                return ListTile(
                  tileColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  leading: Icon(
                    progress?.completed == true
                        ? Icons.check_circle
                        : Icons.school,
                    color: progress?.completed == true
                        ? Theme.of(context).colorScheme.secondary
                        : null,
                  ),
                  title: Text(
                    lesson.title,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  subtitle: Text(
                    '${lesson.courseTitle ?? lesson.category} · ${lesson.durationMinutes} min · ${lesson.points} pts',
                  ),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Icon(Icons.chevron_right),
                      if (progress != null)
                        Text(
                          progress.completed
                              ? '100%'
                              : '${progress.progressPercent}%',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                    ],
                  ),
                  onTap: () => _openLesson(lesson),
                );
              },
            ),
          );
        },
      ),
    );
  }

  void _openLesson(Lesson lesson) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _LessonDetailScreen(
          education: widget.education,
          initialLesson: lesson,
          initialProgress: _progressByLesson[lesson.id],
          onProgressChanged: _loadProgress,
        ),
      ),
    );
  }

  Future<void> _loadProgress() async {
    try {
      final rows = await widget.education.myProgress();
      if (!mounted) return;
      setState(() {
        _progressByLesson = {
          for (final row in rows) row.lesson.id: row,
        };
      });
    } catch (_) {
      if (mounted) setState(() => _progressByLesson = {});
    }
  }
}

class _LessonDetailScreen extends StatefulWidget {
  const _LessonDetailScreen({
    required this.education,
    required this.initialLesson,
    required this.initialProgress,
    required this.onProgressChanged,
  });

  final EducationRepository education;
  final Lesson initialLesson;
  final LessonProgress? initialProgress;
  final VoidCallback onProgressChanged;

  @override
  State<_LessonDetailScreen> createState() => _LessonDetailScreenState();
}

class _LessonDetailScreenState extends State<_LessonDetailScreen> {
  late final Future<Lesson> _lesson =
      widget.education.lesson(widget.initialLesson.id);
  LessonProgress? _progress;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _progress = widget.initialProgress;
    if ((_progress?.progressPercent ?? 0) == 0) {
      widget.education
          .saveLessonProgress(widget.initialLesson.id, 15)
          .then(_setProgress)
          .catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Lesson>(
      future: _lesson,
      initialData: widget.initialLesson,
      builder: (context, snapshot) {
        final lesson = snapshot.data ?? widget.initialLesson;
        final progress = (_progress?.completed ?? false)
            ? 100
            : _progress?.progressPercent ?? 0;

        return Scaffold(
          appBar: AppBar(title: Text(lesson.title)),
          body: ListView(
            padding: EdgeInsets.fromLTRB(
              16,
              16,
              16,
              MediaQuery.paddingOf(context).bottom + 24,
            ),
            children: [
              Text(
                lesson.courseTitle ?? lesson.category,
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text('${lesson.durationMinutes} min · ${lesson.points} pts'),
              const SizedBox(height: 14),
              LinearProgressIndicator(value: progress / 100),
              const SizedBox(height: 8),
              Text(_progress?.completed == true
                  ? 'Completada'
                  : '$progress% de avance'),
              const SizedBox(height: 18),
              if ((lesson.videoUrl ?? '').isNotEmpty) ...[
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.play_circle_outline),
                    title: const Text('Video de la lección'),
                    subtitle: Text(lesson.videoUrl!),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                _plainText(lesson.content),
                style: Theme.of(context)
                    .textTheme
                    .bodyLarge
                    ?.copyWith(height: 1.45),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _saving || (_progress?.completed ?? false)
                    ? null
                    : () => _complete(lesson.id),
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle),
                label: Text((_progress?.completed ?? false)
                    ? 'Lección completada'
                    : 'Marcar como completada'),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _complete(String id) async {
    setState(() => _saving = true);
    try {
      final progress = await widget.education.completeLesson(id);
      _setProgress(progress);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _setProgress(LessonProgress progress) {
    if (!mounted) return;
    setState(() => _progress = progress);
    widget.onProgressChanged();
  }

  String _plainText(String value) => value
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(RegExp('<[^>]*>'), '')
      .replaceAll('&nbsp;', ' ')
      .trim();
}
