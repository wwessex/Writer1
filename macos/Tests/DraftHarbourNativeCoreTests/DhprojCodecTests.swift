import DraftHarbourNativeCore
import XCTest

final class DhprojCodecTests: XCTestCase {
  func testDecodesCurrentDhprojV1Envelope() throws {
    let json = """
    {
      "manifest": {
        "format": "dhproj",
        "version": 1,
        "appVersion": "2.0.0",
        "createdAt": "2026-05-04T00:00:00.000Z"
      },
      "project": {
        "id": "project-1",
        "title": "The Native Draft",
        "projectType": "screenplay",
        "updatedAt": 1777852800000
      },
      "projectType": "screenplay",
      "sections": [
        {
          "id": "section-1",
          "novelId": "project-1",
          "order": 0,
          "title": "Scene 1",
          "updatedAt": 1777852800000,
          "content": "INT. ROOM - DAY\\n@JULES\\nWe made it native.",
          "summary": "",
          "pov": "",
          "status": "draft",
          "tags": [],
          "wordGoal": 0,
          "scenes": []
        }
      ],
      "snapshots": [],
      "commentThreads": [],
      "settings": {
        "autosaveMs": 750,
        "theme": "dark"
      },
      "goalTrends": []
    }
    """

    let envelope = try DhprojCodec.decode(Data(json.utf8))

    XCTAssertEqual(envelope.project.title, "The Native Draft")
    XCTAssertEqual(envelope.projectType, .screenplay)
    XCTAssertEqual(envelope.sections.first?.title, "Scene 1")
    XCTAssertEqual(envelope.settings.autosaveMs, 750)
  }

  func testRoundTripsNewProject() throws {
    let envelope = DhprojCodec.newProject(title: "Round Trip", projectType: .book)
    let data = try DhprojCodec.encode(envelope)
    let decoded = try DhprojCodec.decode(data)

    XCTAssertEqual(decoded.project.title, "Round Trip")
    XCTAssertEqual(decoded.projectType, .book)
    XCTAssertEqual(decoded.sections.count, 1)
    XCTAssertEqual(decoded.sections.first?.order, 0)
  }

  func testRejectsUnsupportedVersion() throws {
    let json = """
    {
      "manifest": { "format": "dhproj", "version": 99, "appVersion": "x", "createdAt": "now" },
      "project": { "id": "p", "title": "Bad", "projectType": "book", "updatedAt": 1 },
      "projectType": "book",
      "sections": []
    }
    """

    XCTAssertThrowsError(try DhprojCodec.decode(Data(json.utf8))) { error in
      XCTAssertEqual(error as? DraftHarbourError, .unsupportedVersion(99))
    }
  }
}
