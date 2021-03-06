// Stitchscape 1.4 ©2011 Starscene Software. All rights reserved. Redistribution without permission not allowed.

import UnityEngine.GUILayout;
import UnityEditor.EditorGUILayout;

enum Direction {Across, Down}

class Stitch extends ScriptableWizard {
	static var across : int;
	static var down : int;
	static var tWidth : int;
	static var tHeight : int;
	static var totalTerrains : int;
	static var terrains : Object[];
	static var stitchWidth : int;
	static var message : String;
	static var terrainRes : int;
	static var lineTex : Texture2D;
	static var maxWidth = 100;
	static var playError = false;
	static var gridPixelHeight = 29;
	static var gridPixelWidth = 121;
	
	@MenuItem ("Publish/terrain/Stitch...")
	static function CreateWizard () {
		if (lineTex == null) {	// across/down etc. defined here, so closing and re-opening wizard doesn't reset vars
			across = down = tWidth = tHeight = 2;
			stitchWidth = 10;
			SetNumberOfTerrains();
			lineTex = EditorGUIUtility.whiteTexture;
		}
		message = "";
		playError = false;
		ScriptableWizard.DisplayWizard("Stitch Terrains", Stitch);
	}
	
	new function OnGUI () {
		if (Application.isPlaying) {
			playError = true;
		}
		if (playError) {	// Needs to continue showing this even if play mode is stopped
			Label("Stitchscape can't run in play mode");
			return;
		}

		BeginHorizontal(Width(220));
			BeginVertical();
				BeginHorizontal(Width(190));
					Label("Number of terrains across:");
					across = Mathf.Max(IntField(across, Width(30)), 1);
				EndHorizontal();
				BeginHorizontal(Width(190));
					Label("Number of terrains down:");
					down = Mathf.Max(IntField(down, Width(30)), 1);
				EndHorizontal();
			EndVertical();
			BeginVertical();
				Space(12);
				if (Button("Apply")) {
					tWidth = across;
					tHeight = down;
					SetNumberOfTerrains();
				}
			EndVertical();
		EndHorizontal();
		
		Space(9);
		
		var counter = 0;
		for (h = 0; h < tHeight; h++) {
			BeginHorizontal();
				Space(22);
				for (w = 0; w < tWidth; w++) {
					terrains[counter] = ObjectField(terrains[counter++], TerrainData, Width(112));
					Space(5);
				}
			EndHorizontal();
			Space(10);
		}
		DrawGrid(Color.black, 1);
		DrawGrid(Color.white, 0);
		GUI.Label(Rect(5, 59, 20, 20), "Z");
		GUI.Label(Rect(gridPixelWidth*tWidth + 10, 65 + gridPixelHeight*tHeight, 20, 20), "X");
		GUI.color = Color.black;
		GUI.DrawTexture(Rect(7, 75, 1, gridPixelHeight*tHeight - 2), lineTex);
		GUI.DrawTexture(Rect(7, 73 + gridPixelHeight*tHeight, gridPixelWidth*tWidth, 1), lineTex);
		GUI.color = Color.white;
		
		Space(10);
		
		BeginHorizontal();
			if (terrains[0] != null) {
				maxWidth = terrains[0].heightmapWidth/2;
			}
			Label("Stitch width: " + stitchWidth, Width(90));
			stitchWidth = HorizontalSlider(stitchWidth, 1, maxWidth);
		EndHorizontal();
		
		Space(2);

		Label(message);

		Space(2);
		
		BeginHorizontal();
			if (Button("Clear")) {
				SetNumberOfTerrains();
			}
			if (Button("Stitch")) {
				StitchTerrains();
			}
		EndHorizontal();
	}
	
	private function DrawGrid (color : Color, offset : int) {
		GUI.color = color;
		for (i = 0; i < tHeight+1; i++) {
			GUI.DrawTexture(Rect(15 + offset, 63 + offset + gridPixelHeight*i, gridPixelWidth*tWidth, 1), lineTex);
		}
		for (i = 0; i < tWidth+1; i++) {
			GUI.DrawTexture(Rect(15 + offset + gridPixelWidth*i, 63 + offset, 1, gridPixelHeight*tHeight + 1), lineTex);		
		}
	}
	
	static function SetNumberOfTerrains () {
		terrains = new Object[tWidth * tHeight];
		totalTerrains = tWidth * tHeight;
		message = "";
	}

	static function StitchTerrains () {
		for (t in terrains) {
			if (t == null) {
				message = "All terrain slots must have a terrain assigned";
				return;
			}
		}
	
		terrainRes = terrains[0].heightmapWidth;
		if (terrains[0].heightmapHeight != terrainRes) {
			message = "Heightmap width and height must be the same";
			return;
		}
		
		for (t in terrains) {
			if (t.heightmapWidth != terrainRes || t.heightmapHeight != terrainRes) {
				message = "All heightmaps must be the same resolution";
				return;
			}
		}
		
		for (t in terrains) {
			Undo.RegisterUndo(t, "Stitch");
		}

		stitchWidth = Mathf.Clamp(stitchWidth, 1, (terrainRes-1)/2);
		var counter = 0;
		var total = tHeight*(tWidth-1) + (tHeight-1)*tWidth;
		
		if (tWidth == 1 && tHeight == 1) {
			BlendData (terrains[0], terrains[0], Direction.Across, true);
			BlendData (terrains[0], terrains[0], Direction.Down, true);
			message = "Terrain has been made repeatable with itself";
		}
		else {
			for (h = 0; h < tHeight; h++) {
				for (w = 0; w < tWidth-1; w++) {
					EditorUtility.DisplayProgressBar("Stitching...", "", Mathf.InverseLerp(0, total, ++counter));
					BlendData (terrains[h*tWidth + w], terrains[h*tWidth + w + 1], Direction.Across, false);
				}
			}
			for (h = 0; h < tHeight-1; h++) {
				for (w = 0; w < tWidth; w++) {
					EditorUtility.DisplayProgressBar("Stitching...", "", Mathf.InverseLerp(0, total, ++counter));
					BlendData (terrains[h*tWidth + w], terrains[(h+1)*tWidth + w], Direction.Down, false);
				}
			}
			message = "Terrains stitched successfully";
		}
		
		EditorUtility.ClearProgressBar();
	}
	
	static function BlendData (terrain1 : TerrainData, terrain2 : TerrainData, thisDirection : Direction, singleTerrain : boolean) {
		var heightmapData = terrain1.GetHeights(0, 0, terrainRes, terrainRes);
		var heightmapData2 = terrain2.GetHeights(0, 0, terrainRes, terrainRes);
		var pos = terrainRes-1;
		
		if (thisDirection == Direction.Across) {
			for (i = 0; i < terrainRes; i++) {
				for (j = 1; j < stitchWidth; j++) {
					var mix = Mathf.Lerp(heightmapData[i, pos-j], heightmapData2[i, j], .5);
					if (j == 1) {
						heightmapData[i, pos] = mix;
						heightmapData2[i, 0] = mix;
					}
					var t = Mathf.SmoothStep(0.0, 1.0, Mathf.InverseLerp(1, stitchWidth-1, j));
					heightmapData[i, pos-j] = Mathf.Lerp(mix, heightmapData[i, pos-j], t);
					if (!singleTerrain) {
						heightmapData2[i, j]    = Mathf.Lerp(mix, heightmapData2[i, j], t);
					}
					else {
						heightmapData[i, j]    = Mathf.Lerp(mix, heightmapData2[i, j], t);
					}
				}
			}
			if (singleTerrain) {
				for (i = 0; i < terrainRes; i++) {
					heightmapData[i, 0] = heightmapData[i, pos];
				}
			}
		}
		else {
			for (i = 0; i < terrainRes; i++) {
				for (j = 1; j < stitchWidth; j++) {
					mix = Mathf.Lerp(heightmapData2[pos-j, i], heightmapData[j, i], .5);
					if (j == 1) {
						heightmapData2[pos, i] = mix;
						heightmapData[0, i] = mix;
					}
					t = Mathf.SmoothStep(0.0, 1.0, Mathf.InverseLerp(1, stitchWidth-1, j));
					if (!singleTerrain) {
						heightmapData2[pos-j, i] = Mathf.Lerp(mix, heightmapData2[pos-j, i], t);
					}
					else {
						heightmapData[pos-j, i] = Mathf.Lerp(mix, heightmapData2[pos-j, i], t);
					}
					heightmapData[j, i]      = Mathf.Lerp(mix, heightmapData[j, i], t);
				}
			}
			if (singleTerrain) {
				for (i = 0; i < terrainRes; i++) {
					heightmapData[pos, i] = heightmapData[0, i];
				}
			}
		}
		
		terrain1.SetHeights(0, 0, heightmapData);
		if (!singleTerrain) {
			terrain2.SetHeights(0, 0, heightmapData2);
		}
	}
}