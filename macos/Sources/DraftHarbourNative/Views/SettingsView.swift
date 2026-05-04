import SwiftUI

struct SettingsView: View {
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @AppStorage("DraftHarbour.ai.endpoint") private var aiEndpoint = "http://localhost:11434/v1/chat/completions"
  @AppStorage("DraftHarbour.ai.model") private var aiModel = "llama3.1"

  var body: some View {
    Form {
      Section("Editor") {
        Slider(value: $fontSize, in: 11...24, step: 1) {
          Text("Font Size")
        } minimumValueLabel: {
          Text("11")
        } maximumValueLabel: {
          Text("24")
        }
        Toggle("Typewriter Mode", isOn: $typewriterMode)
      }

      Section("AI") {
        TextField("Endpoint", text: $aiEndpoint)
        TextField("Model", text: $aiModel)
      }
    }
    .formStyle(.grouped)
    .padding()
    .frame(width: 520)
  }
}
