import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS_DIR))

from build_datasets import _build_rejected_from_chosen  # noqa: E402


class BuildDatasetsTests(unittest.TestCase):
    def test_rejected_is_transformed(self):
        chosen = "The luminous hall breathed with ancient silence, and Mira whispered a trembling vow."
        rejected = _build_rejected_from_chosen(chosen)
        self.assertNotEqual(chosen, rejected)
        self.assertIn("said", rejected.lower())


if __name__ == "__main__":
    unittest.main()
