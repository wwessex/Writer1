import importlib.util
import unittest
from pathlib import Path

API_FILE = Path(__file__).resolve().parents[1] / 'runtime' / 'cloud' / 'api.py'
spec = importlib.util.spec_from_file_location('narratryx_cloud_api', API_FILE)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)
app = module.app


class CloudApiTests(unittest.TestCase):
    def test_app_has_health_route(self):
        paths = {route.path for route in app.router.routes}
        self.assertIn('/health', paths)
        self.assertIn('/v1/chat/completions', paths)


if __name__ == '__main__':
    unittest.main()
