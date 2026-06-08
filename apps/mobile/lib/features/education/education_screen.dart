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

  @override
  void initState() {
    super.initState();
    _lessons = widget.education.lessons();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Educacion vial')),
      body: FutureBuilder<List<Lesson>>(
        future: _lessons,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(
              child: KorviLetterLoader(
                label: 'KORVI Drive',
              ),
            );
          }
          final lessons = snapshot.data!;
          if (lessons.isEmpty) {
            return const Center(child: Text('No hay lecciones disponibles.'));
          }

          return ListView.separated(
            padding: EdgeInsets.fromLTRB(
                16, 16, 16, MediaQuery.paddingOf(context).bottom + 120),
            itemCount: lessons.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final lesson = lessons[index];
              return ListTile(
                tileColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                leading: const Icon(Icons.school),
                title: Text(lesson.title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                    '${lesson.category} · ${lesson.durationMinutes} min · ${lesson.points} pts'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openLesson(lesson),
              );
            },
          );
        },
      ),
    );
  }

  void _openLesson(Lesson lesson) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(lesson.title)),
          body: ListView(
            padding: EdgeInsets.fromLTRB(
                16, 16, 16, MediaQuery.paddingOf(context).bottom + 24),
            children: [
              Text(lesson.category,
                  style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 12),
              Text(lesson.content.replaceAll(RegExp('<[^>]*>'), '')),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () async {
                  await widget.education.completeLesson(lesson.id);
                  if (mounted) Navigator.of(context).pop();
                },
                icon: const Icon(Icons.check_circle),
                label: const Text('Marcar como completada'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
