import React, {memo, useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import {brazilianStates} from '@/data/brazilianLocations';

type SleepHours = 6 | 7 | 8 | 9;

interface SolarSectionProps {
  anticipation: boolean;
  setAnticipation: (v: boolean) => void;
  sleepAlarmEnabled: boolean;
  setSleepAlarmEnabled: (v: boolean) => void;
  sleepHours: SleepHours;
  setSleepHours: (v: SleepHours) => void;
  selectedState: string;
  setSelectedState: (v: string) => void;
  selectedCity: string;
  setSelectedCity: (v: string) => void;
  setCity: (v: string) => void;
  cities: string[];
  loadingCities: boolean;
  cep: string;
  setCep: (v: string) => void;
  cepStatus: string;
  validationErrors: {location: string};
  handleUseCurrentLocation: () => void;
  loadingEstimate: boolean;
  estimatedTime: string;
}

export const SolarSection = memo(function SolarSection(props: SolarSectionProps) {
  const {
    anticipation, setAnticipation,
    sleepAlarmEnabled, setSleepAlarmEnabled,
    sleepHours, setSleepHours,
    selectedState, setSelectedState,
    selectedCity, setSelectedCity, setCity,
    cities, loadingCities,
    cep, setCep, cepStatus,
    validationErrors,
    handleUseCurrentLocation, loadingEstimate, estimatedTime,
  } = props;

  // Defer heavy Pickers — show lightweight UI first, mount Pickers after first frame
  const [pickersReady, setPickersReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPickersReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View>
      {/* Anticipation */}
      <View style={styles.switchRow}>
        <View style={styles.switchTextWrap}>
          <Text style={styles.switchLabel}>Antecipar 15 min</Text>
          <Text style={styles.switchDesc}>
            Acordar 15 minutos antes para ver o nascer do sol
          </Text>
        </View>
        <Switch
          value={anticipation}
          onValueChange={setAnticipation}
          trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
          thumbColor={anticipation ? '#f59e0b' : '#888'}
        />
      </View>

      {/* Sleep Alarm Section */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>🌙 Alarme de Sono</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchTextWrap}>
          <Text style={styles.switchLabel}>Ativar alertas de sono</Text>
          <Text style={styles.switchDesc}>Receba lembretes antes de dormir</Text>
        </View>
        <Switch
          value={sleepAlarmEnabled}
          onValueChange={setSleepAlarmEnabled}
          trackColor={{false: '#333', true: 'rgba(245,158,11,0.4)'}}
          thumbColor={sleepAlarmEnabled ? '#f59e0b' : '#888'}
        />
      </View>
      {sleepAlarmEnabled && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Horas de sono desejadas</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={sleepHours}
              onValueChange={val => setSleepHours(val as SleepHours)}
              style={styles.picker}
              dropdownIconColor="#fff">
              <Picker.Item label="6 horas" value={6} />
              <Picker.Item label="7 horas" value={7} />
              <Picker.Item label="8 horas" value={8} />
              <Picker.Item label="9 horas" value={9} />
            </Picker>
          </View>
        </View>
      )}

      {/* Location Section */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionLabel}>📍 Localização</Text>

      {validationErrors.location ? (
        <Text style={styles.errorText}>{validationErrors.location}</Text>
      ) : null}

      {/* State Picker — deferred to avoid blocking toggle animation */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Estado</Text>
        {pickersReady ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedState}
              onValueChange={val => {
                setSelectedState(val);
                setSelectedCity('');
                setCity('');
              }}
              style={styles.picker}
              dropdownIconColor="#fff">
              <Picker.Item label="Selecione o estado..." value="" />
              {brazilianStates.map(s => (
                <Picker.Item key={s.uf} label={s.name} value={s.name} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.pickerPlaceholder}>
            <Text style={styles.pickerPlaceholderText}>
              {selectedState || 'Selecione o estado...'}
            </Text>
          </View>
        )}
      </View>

      {/* City Picker — deferred */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Cidade</Text>
        {loadingCities ? (
          <ActivityIndicator color="#f59e0b" style={{marginVertical: 8}} />
        ) : pickersReady ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={val => {
                setSelectedCity(val);
                setCity(val);
              }}
              style={styles.picker}
              dropdownIconColor="#fff"
              enabled={cities.length > 0}>
              <Picker.Item label="Selecione a cidade..." value="" />
              {cities.map(c => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.pickerPlaceholder}>
            <Text style={styles.pickerPlaceholderText}>
              {selectedCity || 'Selecione a cidade...'}
            </Text>
          </View>
        )}
      </View>

      {/* CEP Input */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>CEP (opcional)</Text>
        <TextInput
          style={styles.input}
          value={cep}
          onChangeText={setCep}
          placeholder="00000-000"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={9}
        />
        {cepStatus ? <Text style={styles.hintText}>{cepStatus}</Text> : null}
      </View>

      {/* Use Current Location */}
      <TouchableOpacity
        style={styles.outlineButton}
        onPress={handleUseCurrentLocation}
        disabled={loadingEstimate}>
        {loadingEstimate ? (
          <ActivityIndicator color="#f59e0b" size="small" />
        ) : (
          <Text style={styles.outlineButtonText}>📍 Usar Minha Localização</Text>
        )}
      </TouchableOpacity>

      {/* Sunrise Estimate */}
      {estimatedTime ? (
        <View style={styles.estimateCard}>
          <Text style={styles.estimateLabel}>Nascer do sol estimado</Text>
          <Text style={styles.estimateTime}>
            ☀️ {estimatedTime}
            {anticipation ? ' (com antecipação)' : ''}
          </Text>
        </View>
      ) : loadingEstimate ? (
        <ActivityIndicator color="#f59e0b" style={{marginVertical: 12}} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchTextWrap: {flex: 1, marginRight: 12},
  switchLabel: {fontSize: 15, fontWeight: '600', color: '#fff'},
  switchDesc: {fontSize: 12, color: '#777', marginTop: 2},
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 16,
  },
  sectionLabel: {fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12},
  fieldGroup: {gap: 6, marginBottom: 12},
  label: {fontSize: 14, fontWeight: '600', color: '#ccc'},
  input: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  picker: {color: '#fff'},
  pickerPlaceholder: {
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pickerPlaceholderText: {
    color: '#666',
    fontSize: 16,
  },
  errorText: {fontSize: 13, color: '#ef4444'},
  hintText: {fontSize: 12, color: '#777', marginTop: 4},
  outlineButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  outlineButtonText: {fontSize: 14, fontWeight: '600', color: '#f59e0b'},
  estimateCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginTop: 12,
  },
  estimateLabel: {fontSize: 12, color: '#999', marginBottom: 4},
  estimateTime: {fontSize: 20, fontWeight: '700', color: '#f59e0b'},
});
