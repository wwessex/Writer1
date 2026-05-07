import DraftHarbourNativeCore
import SwiftUI

struct SettingsView: View {
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @AppStorage("DraftHarbour.editor.theme") private var theme = "auto"
  @AppStorage("DraftHarbour.release.channel") private var releaseChannel = "stable"
  @AppStorage("DraftHarbour.ai.endpoint") private var aiEndpoint = "http://localhost:11434/v1/chat/completions"
  @AppStorage("DraftHarbour.ai.model") private var aiModel = "llama3.1"
  @AppStorage("DraftHarbour.ai.provider") private var aiProvider = "local-openai"
  @AppStorage("DraftHarbour.sync.baseUrl") private var syncBaseURL = ""

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
        Picker("Theme", selection: themeSelection) {
          Text("Auto").tag("auto")
          Text("Light").tag("light")
          Text("Dark").tag("dark")
        }
      }

      Section("AI") {
        Picker("Provider", selection: $aiProvider) {
          Text("Local OpenAI-compatible").tag("local-openai")
          Text("OpenAI-compatible").tag("openai-compatible")
          Text("Server Proxy").tag("server-proxy")
          Text("Custom LLM").tag("custom-llm")
        }
        TextField("Endpoint", text: $aiEndpoint)
        TextField("Model", text: $aiModel)
      }

      Section("Sync") {
        TextField("Generic REST Sync URL", text: $syncBaseURL)
      }

      Section("Release") {
        Picker("Channel", selection: $releaseChannel) {
          Text("Stable").tag("stable")
          Text("Beta").tag("beta")
          Text("Nightly").tag("nightly")
        }
      }
    }
    .formStyle(.grouped)
    .padding()
    .frame(width: 520)
  }

  private var themeSelection: Binding<String> {
    Binding {
      ThemePreference.normalizedRawValue(theme)
    } set: { newValue in
      theme = ThemePreference.normalizedRawValue(newValue)
    }
  }
}
