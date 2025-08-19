/**
 * Migration Status Dashboard Component
 * Shows real-time status of all migration phases
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Clock, XCircle, Zap } from 'lucide-react';
import { getMigrationDashboard, triggerEmergencyRollback, type MigrationDashboard } from '@/lib/migration-dashboard';

export function MigrationStatusDashboard() {
  const [dashboard, setDashboard] = useState<MigrationDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const updateDashboard = () => {
      try {
        const newDashboard = getMigrationDashboard();
        setDashboard(newDashboard);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to get migration dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    updateDashboard();
    
    // Update every 30 seconds
    const interval = setInterval(updateDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPhaseStatusIcon = (phase: any) => {
    if (!phase.enabled) return <Clock className="h-4 w-4 text-gray-400" />;
    if (phase.failures > phase.successes) return <XCircle className="h-4 w-4 text-red-500" />;
    if (phase.operations > 0) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <Zap className="h-4 w-4 text-blue-500" />;
  };

  const getPhaseStatusColor = (phase: any) => {
    if (!phase.enabled) return 'secondary';
    if (phase.failures > phase.successes) return 'destructive';
    if (phase.operations > 0) return 'default';
    return 'secondary';
  };

  const handleEmergencyRollback = () => {
    if (confirm('Are you sure you want to trigger emergency rollback? This will disable all migration features.')) {
      triggerEmergencyRollback('Manual emergency rollback triggered');
      setTimeout(() => {
        setDashboard(getMigrationDashboard());
      }, 1000);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading migration status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!dashboard) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load migration dashboard. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Migration Status Dashboard</span>
            <Badge variant="outline">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {dashboard.overall.totalOperations}
              </div>
              <div className="text-sm text-gray-600">Total Operations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {dashboard.overall.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {dashboard.overall.activePhasesCount}
              </div>
              <div className="text-sm text-gray-600">Active Phases</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {dashboard.recommendations.length}
              </div>
              <div className="text-sm text-gray-600">Recommendations</div>
            </div>
          </div>

          {/* Phase Status */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Migration Phases</h3>
            {dashboard.phases.map((phase) => (
              <div key={phase.phase} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getPhaseStatusIcon(phase)}
                  <div>
                    <div className="font-medium capitalize">{phase.phase} Phase</div>
                    <div className="text-sm text-gray-600">
                      {phase.operations} operations ({phase.successes} successful, {phase.failures} failed)
                    </div>
                  </div>
                </div>
                <Badge variant={getPhaseStatusColor(phase)}>
                  {phase.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {dashboard.recommendations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
              <div className="space-y-2">
                {dashboard.recommendations.map((rec, index) => (
                  <Alert key={index} variant="default">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{rec}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Emergency Controls */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-red-600">Emergency Controls</h3>
                <p className="text-sm text-gray-600">Use only if migration issues are detected</p>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleEmergencyRollback}
                className="ml-4"
              >
                Emergency Rollback
              </Button>
            </div>
          </div>

          {/* Feature Flags Status */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3">Feature Flags Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(dashboard.featureFlags).map(([flag, enabled]) => (
                <div key={flag} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-xs font-mono">{flag}</span>
                  <Badge variant={enabled ? 'default' : 'secondary'}>
                    {enabled ? 'ON' : 'OFF'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}