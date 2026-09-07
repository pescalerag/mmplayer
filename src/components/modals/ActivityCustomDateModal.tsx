import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { HistoryService } from '../../services/HistoryService';

interface ActivityCustomDateModalProps {
  visible: boolean;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  onClose: () => void;
  onApply: (startDate: Date, endDate: Date) => void;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const SHORT_MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function ActivityCustomDateModal({
  visible,
  initialStartDate,
  initialEndDate,
  onClose,
  onApply,
}: ActivityCustomDateModalProps) {
  const { colors, fonts, radii } = useAppTheme();
  const { t, i18n } = useTranslation();

  const isSpanish = (i18n.language || 'es').startsWith('es');
  const monthNames = isSpanish ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  const shortMonthNames = isSpanish ? SHORT_MONTH_NAMES_ES : SHORT_MONTH_NAMES_EN;
  const weekDayHeaders = isSpanish
    ? ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Fechas de referencia fijas al inicio del día
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    [now]
  );

  // Estados locales de selección
  const [selectedStart, setSelectedStart] = useState<Date>(() => {
    if (initialStartDate) {
      return new Date(initialStartDate.getFullYear(), initialStartDate.getMonth(), initialStartDate.getDate(), 0, 0, 0, 0);
    }
    return todayStart;
  });

  const [selectedEnd, setSelectedEnd] = useState<Date>(() => {
    if (initialEndDate) {
      return new Date(initialEndDate.getFullYear(), initialEndDate.getMonth(), initialEndDate.getDate(), 0, 0, 0, 0);
    }
    return todayStart;
  });

  const [activeTarget, setActiveTarget] = useState<'start' | 'end'>('start');

  // Vista de mes / año en el calendario
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const base = initialEndDate || initialStartDate || now;
    return base.getMonth();
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    const base = initialEndDate || initialStartDate || now;
    return base.getFullYear();
  });

  // Selector rápido de mes y año
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false);
  const [jumpYear, setJumpYear] = useState<number>(viewYear);

  // Sincronizar año de salto con viewYear
  useEffect(() => {
    setJumpYear(viewYear);
  }, [viewYear, isQuickJumpOpen]);

  // Fecha de la primera entrada en base de datos
  const [firstHistoryDate, setFirstHistoryDate] = useState<Date | null>(null);
  const [clampedNotice, setClampedNotice] = useState<string | null>(null);

  // Cargar la primera entrada registrada al abrir el modal
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    (async () => {
      try {
        const first = await HistoryService.getFirstHistoryDate();
        if (isMounted && first) {
          const firstStart = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0);
          setFirstHistoryDate(firstStart);

          // Si la fecha inicial seleccionada es menor a la primera entrada, acotarla
          setSelectedStart((prev) => {
            if (prev.getTime() < firstStart.getTime()) {
              return firstStart;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[ActivityCustomDateModal] Error getting first history date:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible]);

  // Restablecer estados al abrir
  useEffect(() => {
    if (visible) {
      const start = initialStartDate
        ? new Date(initialStartDate.getFullYear(), initialStartDate.getMonth(), initialStartDate.getDate(), 0, 0, 0, 0)
        : todayStart;
      const end = initialEndDate
        ? new Date(initialEndDate.getFullYear(), initialEndDate.getMonth(), initialEndDate.getDate(), 0, 0, 0, 0)
        : todayStart;

      setSelectedStart(start);
      setSelectedEnd(end);
      setActiveTarget('start');
      setViewMonth(end.getMonth());
      setViewYear(end.getFullYear());
      setJumpYear(end.getFullYear());
      setIsQuickJumpOpen(false);
      setClampedNotice(null);
    }
  }, [visible, initialStartDate, initialEndDate, todayStart]);

  // Cálculos de la cuadrícula del calendario
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // Offset para semana que empieza en Lunes (0 = Domingo en JS)
  const startingOffset = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1;
  }, [viewYear, viewMonth]);

  // Navegación de mes con límites estrictos:
  // Límite superior: no avanzar más allá del mes actual
  const isAtCurrentMonth = viewYear === now.getFullYear() && viewMonth >= now.getMonth();
  const canGoNextMonth = !isAtCurrentMonth;

  // Límite inferior: no retroceder antes del mes de la primera actividad
  const isAtFirstMonth = firstHistoryDate
    ? viewYear < firstHistoryDate.getFullYear() ||
      (viewYear === firstHistoryDate.getFullYear() && viewMonth <= firstHistoryDate.getMonth())
    : false;
  const canGoPrevMonth = !isAtFirstMonth;

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    setClampedNotice(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    setClampedNotice(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Función para saltar directamente a un mes y año específico
  const jumpToMonthYear = (targetYear: number, targetMonth: number) => {
    // Si intenta saltar a un mes futuro, no permitirlo
    if (targetYear > now.getFullYear() || (targetYear === now.getFullYear() && targetMonth > now.getMonth())) {
      return;
    }
    // Si intenta saltar a un mes previo a la primera actividad, no permitirlo
    if (firstHistoryDate) {
      if (
        targetYear < firstHistoryDate.getFullYear() ||
        (targetYear === firstHistoryDate.getFullYear() && targetMonth < firstHistoryDate.getMonth())
      ) {
        return;
      }
    }
    setViewYear(targetYear);
    setViewMonth(targetMonth);
    setJumpYear(targetYear);
    setIsQuickJumpOpen(false);
    setClampedNotice(null);
  };

  // Manejo de clic en un día
  const handleSelectDay = (day: number) => {
    const cellDate = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);

    // Límite máximo: No permitir fechas futuras
    if (cellDate.getTime() > todayStart.getTime()) {
      return;
    }

    // Límite inferior: No permitir fechas previas a la primera entrada registrada
    if (firstHistoryDate && cellDate.getTime() < firstHistoryDate.getTime()) {
      return;
    }

    if (activeTarget === 'start') {
      setSelectedStart(cellDate);
      setClampedNotice(null);

      // Si la fecha de inicio queda después de la fecha de fin actual, ajustar también fin
      if (cellDate.getTime() > selectedEnd.getTime()) {
        setSelectedEnd(cellDate);
      }

      // Cambiar automáticamente a seleccionar fin para mayor agilidad
      setActiveTarget('end');
    } else {
      // Selección de Fin
      if (cellDate.getTime() < selectedStart.getTime()) {
        setSelectedStart(cellDate);
        setClampedNotice(null);
      } else {
        setSelectedEnd(cellDate);
        setClampedNotice(null);
      }
    }
  };

  const handleApply = useCallback(() => {
    let finalStart = new Date(selectedStart);
    let finalEnd = new Date(selectedEnd);

    // Si inicio es mayor a fin, aseguramos orden
    if (finalStart.getTime() > finalEnd.getTime()) {
      const temp = finalStart;
      finalStart = finalEnd;
      finalEnd = temp;
    }

    // Acotar a la primera entrada si aplica
    if (firstHistoryDate && finalStart.getTime() < firstHistoryDate.getTime()) {
      finalStart = new Date(firstHistoryDate);
    }

    // Acotar fin a fin de hoy (límite máximo)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (finalEnd.getTime() > todayEnd.getTime()) {
      finalEnd = todayEnd;
    } else {
      finalEnd.setHours(23, 59, 59, 999);
    }

    onApply(finalStart, finalEnd);
    onClose();
  }, [selectedStart, selectedEnd, firstHistoryDate, now, onApply, onClose]);

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar style="light" />
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardContainer}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cardBackground,
                borderRadius: radii.lg || 16,
              },
            ]}
          >
            {/* ENCABEZADO */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Ionicons name="calendar" size={20} color={colors.accentLight} style={{ marginRight: 8 }} />
                <Text style={[styles.title, { fontFamily: fonts.bold, color: colors.text }]}>
                  {t('activity.custom_date_title')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* SELECTOR DE RANGO: INICIO Y FIN */}
            <View style={styles.rangeChipsRow}>
              <TouchableOpacity
                onPress={() => {
                  setActiveTarget('start');
                  setViewMonth(selectedStart.getMonth());
                  setViewYear(selectedStart.getFullYear());
                  setIsQuickJumpOpen(false);
                }}
                activeOpacity={0.8}
                style={[
                  styles.rangeChip,
                  {
                    borderColor: activeTarget === 'start' ? colors.accent : 'rgba(255,255,255,0.08)',
                    backgroundColor: activeTarget === 'start' ? colors.accentAlpha15 : 'rgba(255,255,255,0.03)',
                  },
                ]}
              >
                <Text style={[styles.rangeChipLabel, { fontFamily: fonts.bold, color: activeTarget === 'start' ? colors.accentLight : colors.textSecondary }]}>
                  {t('activity.custom_date_start')}
                </Text>
                <Text style={[styles.rangeChipValue, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                  {formatDateDisplay(selectedStart)}
                </Text>
              </TouchableOpacity>

              <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} style={{ opacity: 0.6 }} />

              <TouchableOpacity
                onPress={() => {
                  setActiveTarget('end');
                  setViewMonth(selectedEnd.getMonth());
                  setViewYear(selectedEnd.getFullYear());
                  setIsQuickJumpOpen(false);
                }}
                activeOpacity={0.8}
                style={[
                  styles.rangeChip,
                  {
                    borderColor: activeTarget === 'end' ? colors.accent : 'rgba(255,255,255,0.08)',
                    backgroundColor: activeTarget === 'end' ? colors.accentAlpha15 : 'rgba(255,255,255,0.03)',
                  },
                ]}
              >
                <Text style={[styles.rangeChipLabel, { fontFamily: fonts.bold, color: activeTarget === 'end' ? colors.accentLight : colors.textSecondary }]}>
                  {t('activity.custom_date_end')}
                </Text>
                <Text style={[styles.rangeChipValue, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
                  {formatDateDisplay(selectedEnd)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* INFORMACIÓN DE LÍMITES Y ACOTAMIENTO */}
            <View style={styles.infoBannerRow}>
              <View style={styles.infoBadge}>
                <Ionicons name="lock-closed-outline" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.infoBadgeText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                  {t('activity.custom_date_limit_today')}
                </Text>
              </View>

              {firstHistoryDate && (
                <View style={styles.infoBadge}>
                  <Ionicons name="time-outline" size={12} color={colors.accentLight} style={{ marginRight: 4 }} />
                  <Text style={[styles.infoBadgeText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
                    {t('activity.custom_date_first_record', {
                      date: firstHistoryDate.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' }),
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* ATAJOS RÁPIDOS DE SALTO */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => jumpToMonthYear(now.getFullYear(), now.getMonth())}
                activeOpacity={0.75}
              >
                <Ionicons name="today-outline" size={12} color={colors.accentLight} style={{ marginRight: 4 }} />
                <Text style={[styles.presetChipText, { fontFamily: fonts.semiBold, color: colors.textSecondary }]}>
                  {t('activity.custom_date_this_month')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetChip, { borderColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => {
                  const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                  const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                  jumpToMonthYear(prevY, prevM);
                }}
                activeOpacity={0.75}
              >
                <Ionicons name="arrow-back-circle-outline" size={12} color={colors.accentLight} style={{ marginRight: 4 }} />
                <Text style={[styles.presetChipText, { fontFamily: fonts.semiBold, color: colors.textSecondary }]}>
                  {t('activity.custom_date_prev_month')}
                </Text>
              </TouchableOpacity>

              {firstHistoryDate && (
                <TouchableOpacity
                  style={[styles.presetChip, { borderColor: 'rgba(255,255,255,0.08)' }]}
                  onPress={() => jumpToMonthYear(firstHistoryDate.getFullYear(), firstHistoryDate.getMonth())}
                  activeOpacity={0.75}
                >
                  <Ionicons name="sparkles-outline" size={12} color={colors.accentLight} style={{ marginRight: 4 }} />
                  <Text style={[styles.presetChipText, { fontFamily: fonts.semiBold, color: colors.textSecondary }]}>
                    {t('activity.custom_date_first_month')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* AVISO DE ACOTAMIENTO SI APLICA */}
            {clampedNotice && (
              <View style={[styles.noticeBox, { backgroundColor: colors.accentAlpha15, borderColor: colors.accent }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accentLight} style={{ marginRight: 6 }} />
                <Text style={[styles.noticeText, { fontFamily: fonts.regular, color: colors.accentLight }]}>
                  {clampedNotice}
                </Text>
              </View>
            )}

            {/* NAVEGADOR DE MES Y AÑO (CON BOTÓN DE DESPLEGABLE) */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                disabled={!canGoPrevMonth}
                style={[styles.navBtn, !canGoPrevMonth && { opacity: 0.25 }]}
                activeOpacity={0.7}
                accessibilityLabel="Mes anterior"
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsQuickJumpOpen(!isQuickJumpOpen)}
                style={[
                  styles.monthTitleBtn,
                  isQuickJumpOpen && { backgroundColor: colors.accentAlpha15, borderColor: colors.accent },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.monthNavTitle, { fontFamily: fonts.bold, color: colors.text }]}>
                  {monthNames[viewMonth]} {viewYear}
                </Text>
                <Ionicons
                  name={isQuickJumpOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={colors.accentLight}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNextMonth}
                disabled={!canGoNextMonth}
                style={[styles.navBtn, !canGoNextMonth && { opacity: 0.25 }]}
                activeOpacity={0.7}
                accessibilityLabel="Mes siguiente"
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* VISTA ALTERNABLE: SELECTOR RÁPIDO DE MES/AÑO vs CUADRÍCULA DE DÍAS */}
            {isQuickJumpOpen ? (
              <View style={styles.quickJumpContainer}>
                {/* SELECTOR DE AÑO */}
                <View style={styles.quickYearRow}>
                  <TouchableOpacity
                    onPress={() => {
                      const minYear = firstHistoryDate ? firstHistoryDate.getFullYear() : 1970;
                      if (jumpYear > minYear) {
                        setJumpYear((prev) => prev - 1);
                      }
                    }}
                    disabled={firstHistoryDate ? jumpYear <= firstHistoryDate.getFullYear() : false}
                    style={[
                      styles.navBtn,
                      (firstHistoryDate ? jumpYear <= firstHistoryDate.getFullYear() : false) && { opacity: 0.25 },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </TouchableOpacity>

                  <Text style={[styles.quickYearText, { fontFamily: fonts.bold, color: colors.text }]}>
                    {jumpYear}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      if (jumpYear < now.getFullYear()) {
                        setJumpYear((prev) => prev + 1);
                      }
                    }}
                    disabled={jumpYear >= now.getFullYear()}
                    style={[styles.navBtn, jumpYear >= now.getFullYear() && { opacity: 0.25 }]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* CUADRÍCULA DE 12 MESES */}
                <View style={styles.monthsGrid}>
                  {shortMonthNames.map((mName, idx) => {
                    const isFutureMonth =
                      jumpYear > now.getFullYear() ||
                      (jumpYear === now.getFullYear() && idx > now.getMonth());
                    const isBeforeFirstMonth = firstHistoryDate
                      ? jumpYear < firstHistoryDate.getFullYear() ||
                        (jumpYear === firstHistoryDate.getFullYear() && idx < firstHistoryDate.getMonth())
                      : false;
                    const isMonthDisabled = isFutureMonth || isBeforeFirstMonth;
                    const isSelected = jumpYear === viewYear && idx === viewMonth;

                    return (
                      <TouchableOpacity
                        key={`month-jump-${idx}`}
                        disabled={isMonthDisabled}
                        onPress={() => jumpToMonthYear(jumpYear, idx)}
                        activeOpacity={0.7}
                        style={[
                          styles.monthGridItem,
                          isSelected && { backgroundColor: colors.accent },
                          isMonthDisabled && { opacity: 0.22 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthGridItemText,
                            {
                              fontFamily: isSelected ? fonts.bold : fonts.semiBold,
                              color: isSelected
                                ? colors.onAccent
                                : isMonthDisabled
                                ? 'rgba(255,255,255,0.25)'
                                : colors.text,
                            },
                          ]}
                        >
                          {mName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                {/* DÍAS DE LA SEMANA */}
                <View style={styles.weekHeaderRow}>
                  {weekDayHeaders.map((dayName, idx) => (
                    <View key={`weekday-${idx}`} style={styles.weekHeaderCell}>
                      <Text style={[styles.weekHeaderText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                        {dayName}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* CUADRÍCULA DE DÍAS */}
                <View style={styles.daysGrid}>
                  {/* Celdas vacías previas al día 1 */}
                  {Array.from({ length: startingOffset }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCell} />
                  ))}

                  {/* Días del mes */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const cellDate = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
                    const cellTime = cellDate.getTime();
                    const isFuture = cellTime > todayStart.getTime();
                    const isBeforeFirst = firstHistoryDate ? cellTime < firstHistoryDate.getTime() : false;
                    const isDisabled = isFuture || isBeforeFirst;

                    const isStart = cellTime === selectedStart.getTime();
                    const isEnd = cellTime === selectedEnd.getTime();
                    const isInRange = cellTime > selectedStart.getTime() && cellTime < selectedEnd.getTime();
                    const isToday = cellTime === todayStart.getTime();

                    return (
                      <View key={`day-${day}`} style={styles.dayCell}>
                        {/* Barra de rango continuo de fondo */}
                        {isInRange && (
                          <View style={[styles.rangeFill, { backgroundColor: colors.accentAlpha20 }]} />
                        )}
                        {isStart && selectedStart.getTime() < selectedEnd.getTime() && (
                          <View style={[styles.rangeFillRight, { backgroundColor: colors.accentAlpha20 }]} />
                        )}
                        {isEnd && selectedStart.getTime() < selectedEnd.getTime() && (
                          <View style={[styles.rangeFillLeft, { backgroundColor: colors.accentAlpha20 }]} />
                        )}

                        <TouchableOpacity
                          disabled={isDisabled}
                          onPress={() => handleSelectDay(day)}
                          activeOpacity={0.7}
                          style={[
                            styles.dayCircle,
                            (isStart || isEnd) && { backgroundColor: colors.accent },
                            isToday && !isStart && !isEnd && { borderWidth: 1, borderColor: colors.accentLight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              {
                                fontFamily: isStart || isEnd || isToday ? fonts.bold : fonts.regular,
                                color: isStart || isEnd
                                  ? colors.onAccent
                                  : isDisabled
                                  ? 'rgba(255,255,255,0.18)'
                                  : colors.text,
                              },
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* BOTONES DE ACCIÓN */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.actionBtn, styles.cancelBtn]}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApply}
                style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.acceptBtnText, { fontFamily: fonts.bold, color: colors.onAccent }]}>
                  {t('activity.apply')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
  },
  rangeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  rangeChipLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rangeChipValue: {
    fontSize: 12,
  },
  infoBannerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  infoBadgeText: {
    fontSize: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetChipText: {
    fontSize: 11,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 11,
    flex: 1,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  monthNavTitle: {
    fontSize: 15,
  },
  quickJumpContainer: {
    paddingVertical: 6,
  },
  quickYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  quickYearText: {
    fontSize: 18,
    letterSpacing: 0.5,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monthGridItem: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthGridItemText: {
    fontSize: 13,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekHeaderText: {
    fontSize: 11,
    opacity: 0.7,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 2,
  },
  rangeFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 4,
  },
  rangeFillRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: 4,
    bottom: 4,
  },
  rangeFillLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: 4,
    bottom: 4,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    fontSize: 14,
  },
  acceptBtn: {
    minWidth: 95,
  },
  acceptBtnText: {
    fontSize: 14,
  },
});
