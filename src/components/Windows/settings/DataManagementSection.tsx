import { Button } from '@/components/UI';
import { clearAllData } from '@/lib/storage';

interface DataManagementSectionProps {
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function DataManagementSection({ isFieldVisible, highlightMatch }: DataManagementSectionProps) {
  const handleResetData = async () => {
    if (confirm('This will delete ALL your data including novels, chapters, and snapshots. This cannot be undone. Continue?')) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <>
      {isFieldVisible('data', 'resetAllData') && <Button variant="danger" onClick={handleResetData}>
        <span className="material-symbols-rounded">delete_forever</span>
        {highlightMatch('Reset All Data')}
      </Button>}
    </>
  );
}
