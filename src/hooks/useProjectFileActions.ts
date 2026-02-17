import { useCallback, useRef } from 'react';
import { exportBackup, importBackup, exportDhproj, importDhproj, createChapter, addChapter } from '@/lib/storage';
import { importFile, mapImportedContentToProjectType } from '@/lib/import';
import { downloadFile } from '@/lib/utils';
import type { AppState } from '@/types';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;

interface UseProjectFileActionsParams {
  state: AppState;
  loadNovel: () => Promise<void>;
  showToast: ToastFn;
}

export function useProjectFileActions({ state, loadNovel, showToast }: UseProjectFileActionsParams) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = useCallback(async () => {
    try {
      const backup = await exportBackup(state.novelId, true);
      const json = JSON.stringify(backup, null, 2);
      downloadFile(json, `${state.novelTitle}-backup.json`);
      showToast('Backup exported successfully', 'success', 'download_done');
    } catch (err) {
      console.error('Backup export failed:', err);
      showToast('Failed to export backup', 'error');
    }
  }, [state.novelId, state.novelTitle, showToast]);

  const handleSaveProjectFile = useCallback(async () => {
    try {
      const blob = await exportDhproj(state.novelId);
      downloadFile(blob, `${state.novelTitle}.dhproj`);
      showToast('Project file saved', 'success', 'save');
    } catch (err) {
      console.error('Project file save failed:', err);
      showToast('Failed to save project file', 'error');
    }
  }, [state.novelId, state.novelTitle, showToast]);

  const handleOpenProjectFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importDhproj(file);
      showToast('Project file opened successfully. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error('Project file open failed:', err);
      showToast('Failed to open project file. Check the file format.', 'error');
    }

    e.target.value = '';
  }, [showToast]);

  const handleImportBackup = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await importBackup(backup);
      showToast('Backup imported successfully. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error('Backup import failed:', err);
      showToast('Failed to import backup. Check the file format.', 'error');
    }

    e.target.value = '';
  }, [showToast]);

  const handleImportDocument = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importFile(file);

      for (let i = 0; i < result.sections.length; i++) {
        const importedSection = result.sections[i];
        const chapter = createChapter(
          state.novelId,
          state.chapters.length + i,
          importedSection.title,
          state.projectType
        );
        chapter.content = mapImportedContentToProjectType(importedSection.content, state.projectType);
        await addChapter(chapter);
      }

      const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';
      showToast(
        `Imported ${result.sections.length} ${sectionLabel}${result.sections.length !== 1 ? 's' : ''}`,
        'success',
        'upload_file'
      );

      if (result.notices.length > 0) {
        const firstNotice = result.notices[0];
        showToast(
          `Imported with ${result.notices.length} note${result.notices.length !== 1 ? 's' : ''}: ${firstNotice.message}`,
          'info'
        );
      }

      await loadNovel();
    } catch (err) {
      console.error('Document import failed:', err);
      showToast('Failed to import document. Check the file format.', 'error');
    }

    e.target.value = '';
  }, [loadNovel, showToast, state.chapters.length, state.novelId, state.projectType]);

  return {
    fileInputRef,
    importInputRef,
    projectFileInputRef,
    handleExportBackup,
    handleSaveProjectFile,
    handleOpenProjectFile,
    handleImportBackup,
    handleImportDocument,
  };
}
