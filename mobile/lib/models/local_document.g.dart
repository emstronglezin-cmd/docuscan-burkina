// GENERATED CODE - Adapter Hive ecrit manuellement pour LocalDocument.
// Correspond au schema defini dans local_document.dart (typeId: 0).

part of 'local_document.dart';

class LocalDocumentAdapter extends TypeAdapter<LocalDocument> {
  @override
  final int typeId = 0;

  @override
  LocalDocument read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return LocalDocument(
      id: fields[0] as String,
      name: fields[1] as String,
      pageImagePaths: (fields[2] as List).cast<String>(),
      createdAt: fields[3] as DateTime,
      pageCount: fields[4] as int,
      pdfPath: fields[5] as String?,
      fileSizeBytes: fields[6] as int?,
      exported: fields[7] == null ? false : fields[7] as bool,
    );
  }

  @override
  void write(BinaryWriter writer, LocalDocument obj) {
    writer
      ..writeByte(8)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.name)
      ..writeByte(2)
      ..write(obj.pageImagePaths)
      ..writeByte(3)
      ..write(obj.createdAt)
      ..writeByte(4)
      ..write(obj.pageCount)
      ..writeByte(5)
      ..write(obj.pdfPath)
      ..writeByte(6)
      ..write(obj.fileSizeBytes)
      ..writeByte(7)
      ..write(obj.exported);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalDocumentAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
